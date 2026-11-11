import { bit, floorPenalty, FLOOR_SIZE, type GameState, legalMoves, type Move, placementScore, wallCol } from '../engine';

/**
 * Valoración rápida y analítica de una jugada (sin clonar): puntos al alicatar,
 * progreso parcial de la línea y penalización del suelo. Se usa en rollouts y
 * para estimar la mejor respuesta de los rivales.
 */
export function quickScore(s: GameState, player: number, m: Move): number {
  const p = s.players[player];
  const src = m.source === 'center' ? s.center : s.factories[m.source];
  const n = src[m.color];
  const token = m.source === 'center' && s.centerHasFirst ? 1 : 0;
  let put = 0;
  let gain = 0;
  if (m.target !== 'floor') {
    const r = m.target;
    put = Math.min(r + 1 - p.lineCount[r], n);
    const col = wallCol(r, m.color);
    const filled = p.lineCount[r] + put;
    if (filled === r + 1) gain = placementScore(p.wall | bit(r, col), r, col).points + 0.4;
    else gain = 0.55 * (filled / (r + 1)) * (1 + 0.15 * r) - (p.lineCount[r] === 0 ? 0.15 : 0);
    // Preferencia leve por el centro del muro.
    gain += col === 2 ? 0.1 : col === 1 || col === 3 ? 0.05 : 0;
  }
  const over = n - put;
  const L = p.floor.length;
  const added = Math.min(FLOOR_SIZE - L, token + over);
  const pen = floorPenalty(L + added) - floorPenalty(L);
  return gain - pen + (token ? 0.7 : 0);
}

/** Mejor jugada rápida de un jugador en la posición (como si le tocara). */
export function bestQuickResponse(s: GameState, player: number): { move: Move | null; value: number } {
  const saved = s.current;
  s.current = player;
  const moves = legalMoves(s);
  s.current = saved;
  let best: Move | null = null;
  let value = -Infinity;
  for (const m of moves) {
    const v = quickScore(s, player, m);
    if (v > value) {
      value = v;
      best = m;
    }
  }
  return { move: best, value: best ? value : 0 };
}
