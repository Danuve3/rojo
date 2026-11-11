import { applyTurn, endRound, type GameState, isRoundOver, legalMoves, type Rng } from '../engine';
import { quickScore } from './quick';

/** Política de rollout guiada por la heurística rápida (con algo de ruido). */
export function rolloutStep(s: GameState, rnd: Rng): void {
  const moves = legalMoves(s);
  const player = s.current;
  let best = 0;
  let second = -1;
  let bestV = -Infinity;
  let secondV = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    const v = quickScore(s, player, moves[i]) + rnd() * 0.25;
    if (v > bestV) {
      second = best;
      secondV = bestV;
      best = i;
      bestV = v;
    } else if (v > secondV) {
      second = i;
      secondV = v;
    }
  }
  const pick = second >= 0 && rnd() < 0.15 ? second : best;
  applyTurn(s, moves[pick]);
}

/** Juega hasta el final de la ronda actual (incluido el alicatado). */
export function playOutRound(s: GameState, rnd: Rng): void {
  let guard = 0;
  while (s.phase === 'playing' && !isRoundOver(s) && guard++ < 200) rolloutStep(s, rnd);
  if (s.phase === 'playing' && isRoundOver(s)) endRound(s);
}
