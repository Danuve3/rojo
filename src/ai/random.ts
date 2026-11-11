import type { GameState, Move } from '../engine';
import { legalMoves } from '../engine';
import type { Rng } from '../engine/rng';

/**
 * Niveles 1–2: jugada aleatoria entre las legales, con sesgo a no tirar al suelo.
 * `floorBias` es la probabilidad de descartar una jugada que manda losetas al suelo
 * cuando existe alguna alternativa limpia.
 */
export function randomMove(s: GameState, rnd: Rng, floorBias: number): Move {
  const moves = legalMoves(s);
  const p = s.players[s.current];
  const spills = (m: Move): boolean => {
    if (m.target === 'floor') return true;
    const src = m.source === 'center' ? s.center : s.factories[m.source];
    return src[m.color] > m.target + 1 - p.lineCount[m.target];
  };
  const clean = moves.filter((m) => !spills(m));
  const pool = clean.length > 0 && rnd() < floorBias ? clean : moves;
  return pool[Math.floor(rnd() * pool.length)];
}
