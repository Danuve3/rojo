import type { GameState, Move } from '../engine';

/** Normaliza el expositor de una jugada al primero con contenido idéntico (como hace legalMoves). */
export function canonicalMove(s: GameState, m: Move): Move {
  if (m.source === 'center') return m;
  const key = s.factories[m.source].join(',');
  const first = s.factories.findIndex((f) => f.join(',') === key);
  return first >= 0 ? { ...m, source: first } : m;
}
