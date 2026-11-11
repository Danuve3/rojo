import { evaluateWith, prepareEval, type EvalBase } from '../ai/evaluate';
import { Mcts } from '../ai/mcts';
import { cloneState, createRng, type GameState, isLegal, legalMoves, type Move, moveKey, randomSeed, stateKey } from '../engine';
import { explainLoss } from './explain';
import type { Analysis, MoveAnalysis, Verdict } from './types';
import { isMistake, labelFor, TAG_OF_FACTOR } from './verdict';
import { canonicalMove } from './canonical';
import { topLossFactors } from './explain';

interface Entry {
  key: string;
  state: GameState;
  tree: Mcts;
  base: EvalBase;
  evals: Map<string, MoveAnalysis['factors'] & object>;
  rivals: Map<string, MoveAnalysis['rival']>;
  spentMs: number;
}

const SLICE_MS = 30;
const MIN_RATE_VISITS = 400;
const MAX_ENTRIES = 6;

const yieldToEvents = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Análisis del entrenador: MCTS con presupuesto generoso sobre clones del estado,
 * cacheado por posición. Corre dentro del worker en porciones para poder cancelarse.
 */
export class CoachEngine {
  private entries = new Map<string, Entry>();
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  private entry(state: GameState): Entry {
    const key = stateKey(state);
    let e = this.entries.get(key);
    if (!e) {
      const st = cloneState(state);
      e = {
        key,
        state: st,
        tree: new Mcts(st, { rnd: createRng(randomSeed()), wideRoot: true, exploration: 1.1 }),
        base: prepareEval(st, { rivals: true }),
        evals: new Map(),
        rivals: new Map(),
        spentMs: 0,
      };
      this.entries.set(key, e);
      if (this.entries.size > MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value as string);
    }
    return e;
  }

  private moveAnalysis(e: Entry, move: Move, value: number, visits: number): MoveAnalysis {
    const k = moveKey(move);
    if (!e.evals.has(k)) {
      const ev = evaluateWith(e.base, move, { rivals: true });
      e.evals.set(k, ev.factores);
      e.rivals.set(k, ev.rival);
    }
    return { move, value, visits, factors: e.evals.get(k) as MoveAnalysis['factors'], rival: e.rivals.get(k) ?? null };
  }

  private async think(e: Entry, budgetMs: number, isCancelled: () => boolean): Promise<void> {
    this.cancelled = false;
    const target = e.spentMs + budgetMs;
    while (e.spentMs < target) {
      if (this.cancelled || isCancelled()) return;
      const t0 = performance.now();
      e.tree.run(SLICE_MS);
      e.spentMs += performance.now() - t0;
      await yieldToEvents();
    }
  }

  private build(e: Entry): Analysis {
    const results = e.tree.results().filter((r) => r.visits > 0);
    const maxV = results.reduce((m, r) => Math.max(m, r.visits), 0);
    const solid = results.filter((r) => r.visits >= Math.max(8, maxV * 0.04));
    const moves = (solid.length ? solid : results)
      .sort((a, b) => b.value - a.value)
      .map((r) => this.moveAnalysis(e, r.move, r.value, r.visits));
    return { key: e.key, player: e.state.current, moves, iterations: e.tree.iterations, ms: Math.round(e.spentMs) };
  }

  async analyze(state: GameState, budgetMs: number, isCancelled: () => boolean = () => false): Promise<Analysis | null> {
    if (legalMoves(state).length === 0) return null;
    const e = this.entry(state);
    if (e.spentMs < budgetMs) await this.think(e, budgetMs - e.spentMs, isCancelled);
    return this.build(e);
  }

  async rate(state: GameState, played: Move, names: string[], budgetMs: number): Promise<Verdict | null> {
    if (!isLegal(state, played)) return null;
    const e = this.entry(state);
    // Si se jugó antes de terminar el análisis, basta con un mínimo: las dos jugadas
    // comparadas reciben luego visitas forzadas.
    const min = budgetMs * 0.3;
    if (e.spentMs < min) await this.think(e, min - e.spentMs, () => false);
    const move = canonicalMove(state, played);
    let best = this.build(e).moves[0];
    e.tree.ensureVisits(best.move, MIN_RATE_VISITS);
    e.tree.ensureVisits(move, MIN_RATE_VISITS);
    const all = this.build(e).moves;
    best = all[0];
    const key = moveKey(move);
    const stat = e.tree.results().find((r) => moveKey(r.move) === key);
    const mine = all.find((m) => moveKey(m.move) === key) ?? this.moveAnalysis(e, move, stat?.value ?? best.value, stat?.visits ?? 0);
    const loss = moveKey(best.move) === key ? 0 : Math.max(0, best.value - mine.value);
    const label = labelFor(loss);
    const reasons = label === 'excelente' ? [] : explainLoss(mine, best, names);
    const tags = isMistake(label) ? [...new Set(topLossFactors(mine, best).slice(0, 2).map(({ f }) => TAG_OF_FACTOR[f]))] : [];
    return { label, loss, best, mine, reasons, tags };
  }
}
