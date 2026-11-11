import { chooseBotMove } from '../src/ai/bot';
import { levelParams } from '../src/ai/levels';
import { createRng, newGame, step, winners } from '../src/engine';

export interface MatchResult {
  scores: number[];
  winners: number[];
  levels: number[];
}

/** Partida bot contra bot. `scale` reduce el presupuesto de MCTS (iteraciones ≈ 20 por ms). */
export function playMatch(levels: number[], seed: number, scale: number): MatchResult {
  const s = newGame(levels.length, seed, seed % levels.length);
  const rnd = createRng(seed * 7919 + 13);
  while (s.phase === 'playing') {
    const lvl = levels[s.current];
    const lp = levelParams(lvl);
    const iterations = lp.mode === 'mcts' ? Math.max(200, Math.round(lp.budgetMs * 20 * scale)) : undefined;
    const m = chooseBotMove(s, lvl, rnd, { iterations, budgetMs: iterations ? 1e9 : undefined });
    step(s, m);
  }
  return { scores: s.players.map((p) => p.score), winners: winners(s), levels };
}
