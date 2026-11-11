import {
  applyTurn, cloneState, endRound, type GameState, isRoundOver, legalMoves, type Move, moveKey, type Rng,
} from '../engine';
import { evaluateWith, prepareEval } from './evaluate';
import { stateValues } from './features';
import { quickScore } from './quick';
import { playOutRound } from './rollout';

export interface MctsOptions {
  budgetMs?: number;
  iterations?: number;
  rnd: Rng;
  /** Rondas extra que juega el rollout tras la actual. */
  extraRounds?: number;
  /** Todas las jugadas raíz se expanden (análisis del entrenador). */
  wideRoot?: boolean;
  exploration?: number;
}

export interface MoveStat {
  move: Move;
  visits: number;
  /** Margen medio (puntos) del jugador raíz frente al mejor rival. */
  value: number;
  prior: number;
}

const REWARD_SCALE = 8;

class Node {
  children: Node[] = [];
  untried: Array<{ move: Move; prior: number }> | null = null;
  visits = 0;
  reward: number[];
  margin: number[];
  constructor(readonly move: Move | null, readonly player: number, readonly prior: number, players: number, readonly terminal = false) {
    this.reward = new Array<number>(players).fill(0);
    this.margin = new Array<number>(players).fill(0);
  }
}

function margins(values: number[]): number[] {
  return values.map((v, i) => {
    let best = -Infinity;
    for (let j = 0; j < values.length; j++) if (j !== i && values[j] > best) best = values[j];
    return v - best;
  });
}

/** MCTS con determinización: la bolsa (el RNG) se baraja en cada simulación. */
export class Mcts {
  readonly root: Node;
  private rootPlayer: number;
  iterations = 0;
  private c: number;

  constructor(private state: GameState, private opts: MctsOptions) {
    this.rootPlayer = state.current;
    this.root = new Node(null, -1, 0, state.numPlayers);
    this.c = opts.exploration ?? 0.9;
    const base = prepareEval(state, { rivals: true });
    this.root.untried = legalMoves(state)
      .map((move) => ({ move, prior: evaluateWith(base, move, { rivals: true }).total }))
      .sort((a, b) => b.prior - a.prior);
  }

  private expandList(s: GameState): Array<{ move: Move; prior: number }> {
    const p = s.current;
    return legalMoves(s)
      .map((move) => ({ move, prior: quickScore(s, p, move) }))
      .sort((a, b) => b.prior - a.prior);
  }

  private widen(n: Node, isRoot: boolean): boolean {
    if (!n.untried || n.untried.length === 0) return false;
    if (isRoot && this.opts.wideRoot) return true;
    const allowed = 2 + Math.floor(1.5 * Math.sqrt(n.visits));
    return n.children.length < allowed;
  }

  private select(n: Node, mover: number): Node {
    const logN = Math.log(n.visits + 1);
    let best = n.children[0];
    let bestU = -Infinity;
    for (const ch of n.children) {
      const u = ch.visits === 0 ? 1e9 + ch.prior : ch.reward[mover] / ch.visits + this.c * Math.sqrt(logN / ch.visits);
      if (u > bestU) {
        bestU = u;
        best = ch;
      }
    }
    return best;
  }

  private addChild(n: Node, s: GameState, entry: { move: Move; prior: number }): Node {
    const mover = s.current;
    applyTurn(s, entry.move);
    const ch = new Node(entry.move, mover, entry.prior, s.numPlayers, isRoundOver(s));
    n.children.push(ch);
    return ch;
  }

  /** Una iteración. Si `forced` se indica, la primera jugada es esa. */
  iterate(forced?: Move): void {
    const s = cloneState(this.state);
    s.rng = (this.opts.rnd() * 0x100000000) | 0;
    const path: Node[] = [this.root];
    let node = this.root;
    if (forced) {
      const key = moveKey(forced);
      let ch = node.children.find((c) => c.move && moveKey(c.move) === key);
      if (ch) applyTurn(s, forced);
      else {
        const idx = node.untried?.findIndex((u) => moveKey(u.move) === key) ?? -1;
        const entry = idx >= 0 && node.untried ? node.untried.splice(idx, 1)[0] : { move: forced, prior: 0 };
        ch = this.addChild(node, s, entry);
      }
      node = ch;
      path.push(node);
    }
    while (!node.terminal && s.phase === 'playing') {
      const isRoot = node === this.root;
      if (!node.untried) node.untried = this.expandList(s);
      if (this.widen(node, isRoot)) {
        const entry = node.untried.shift();
        if (!entry) break;
        node = this.addChild(node, s, entry);
        path.push(node);
        break;
      }
      if (node.children.length === 0) break;
      const mover = s.current;
      node = this.select(node, mover);
      applyTurn(s, node.move as Move);
      path.push(node);
    }
    if (s.phase === 'playing') {
      if (isRoundOver(s)) endRound(s);
      else playOutRound(s, this.opts.rnd);
      for (let r = 0; r < (this.opts.extraRounds ?? 0) && s.phase === 'playing'; r++) playOutRound(s, this.opts.rnd);
    }
    const m = margins(stateValues(s));
    const rw = m.map((x) => 1 / (1 + Math.exp(-x / REWARD_SCALE)));
    for (const n of path) {
      n.visits++;
      for (let i = 0; i < m.length; i++) {
        n.reward[i] += rw[i];
        n.margin[i] += m[i];
      }
    }
    this.iterations++;
  }

  run(budgetMs: number, maxIterations = Infinity): void {
    const end = performance.now() + budgetMs;
    let i = 0;
    while (i < maxIterations) {
      this.iterate();
      i++;
      if ((i & 3) === 0 && performance.now() >= end) break;
    }
  }

  /** Garantiza un mínimo de visitas para una jugada raíz concreta. */
  ensureVisits(move: Move, n: number): void {
    const key = moveKey(move);
    const visits = () => this.root.children.find((c) => c.move && moveKey(c.move) === key)?.visits ?? 0;
    let guard = 0;
    while (visits() < n && guard++ < n * 2) this.iterate(move);
  }

  results(): MoveStat[] {
    const p = this.rootPlayer;
    const stats: MoveStat[] = this.root.children.map((c) => ({
      move: c.move as Move,
      visits: c.visits,
      value: c.visits ? c.margin[p] / c.visits : -Infinity,
      prior: c.prior,
    }));
    for (const u of this.root.untried ?? []) stats.push({ move: u.move, visits: 0, value: -Infinity, prior: u.prior });
    return stats.sort((a, b) => b.visits - a.visits || b.prior - a.prior);
  }
}

export interface MctsResult {
  moves: MoveStat[];
  iterations: number;
}

/** Búsqueda para un bot: devuelve las jugadas raíz con valor; las poco visitadas se descartan. */
export function mctsSearch(s: GameState, opts: MctsOptions): MctsResult {
  const tree = new Mcts(s, opts);
  tree.run(opts.budgetMs ?? 500, opts.iterations ?? Infinity);
  const all = tree.results();
  const maxV = all[0]?.visits ?? 0;
  const moves = all.filter((m) => m.visits >= Math.max(1, maxV * 0.15));
  return { moves: moves.length ? moves : all.slice(0, 1), iterations: tree.iterations };
}
