import { type GameState, legalMoves, type Move, type Rng } from '../engine';
import { evaluateWith, prepareEval } from './evaluate';
import { levelParams } from './levels';
import { mctsSearch } from './mcts';
import { randomMove } from './random';
import { noisyArgmax } from './select';

export interface BotOptions {
  /** Sustituye el presupuesto de tiempo de MCTS (scripts de torneo). */
  budgetMs?: number;
  iterations?: number;
}

/** Motor de decisión único: la dificultad (1–10) ajusta ruido, profundidad y presupuesto. */
export function chooseBotMove(s: GameState, level: number, rnd: Rng, opts: BotOptions = {}): Move {
  const lp = levelParams(level);
  if (lp.mode === 'random') return randomMove(s, rnd, lp.floorBias);
  const moves = legalMoves(s);
  if (moves.length === 1) return moves[0];
  if (lp.mode === 'mcts') {
    const res = mctsSearch(s, {
      budgetMs: opts.budgetMs ?? lp.budgetMs,
      iterations: opts.iterations,
      rnd,
    });
    const values = res.moves.map((m) => m.value);
    return res.moves[noisyArgmax(values, lp.epsilon, lp.temperature, rnd)].move;
  }
  const rivals = lp.mode === 'deny';
  const base = prepareEval(s, { rivals });
  const values = moves.map((m) => evaluateWith(base, m, { rivals }).total);
  return moves[noisyArgmax(values, lp.epsilon, lp.temperature, rnd)];
}
