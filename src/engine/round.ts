import { bit, COL_BONUS, COLOR_BONUS, FIRST_TOKEN, floorPenalty, ROW_BONUS, TILES_PER_FACTORY, wallCol } from './constants';
import { nextRandom } from './rng';
import { sum } from './state';
import type { Bonus, Color, FloorPenalty, GameState, Placement, PlayerState, RoundSummary } from './types';
import { completeColors, completeCols, completeRows, placementScore, rowCount } from './wall';

/** Saca una loseta de la bolsa; si se vacía, se rellena con la caja. -1 si no queda nada. */
export function drawTile(s: GameState): number {
  let total = sum(s.bag);
  if (total === 0) {
    for (let c = 0; c < 5; c++) {
      s.bag[c] = s.box[c];
      s.box[c] = 0;
    }
    total = sum(s.bag);
    if (total === 0) return -1;
  }
  let r = Math.floor(nextRandom(s) * total);
  for (let c = 0; c < 5; c++) {
    if (r < s.bag[c]) {
      s.bag[c]--;
      return c;
    }
    r -= s.bag[c];
  }
  throw new Error('Bolsa inconsistente');
}

/** Prepara una ronda: llena expositores y pone la ficha inicial en el centro. */
export function startRound(s: GameState): void {
  s.round++;
  s.center.fill(0);
  s.centerHasFirst = true;
  s.firstTaker = -1;
  for (const f of s.factories) {
    f.fill(0);
    for (let i = 0; i < TILES_PER_FACTORY; i++) {
      const c = drawTile(s);
      if (c < 0) break;
      f[c]++;
    }
  }
  s.current = s.roundStarter;
}

export function isRoundOver(s: GameState): boolean {
  if (sum(s.center) > 0) return false;
  for (const f of s.factories) if (sum(f) > 0) return false;
  return true;
}

/** Alicata una línea si está completa. Devuelve la colocación o null. */
export function tileLine(s: GameState, player: number, row: number): Placement | null {
  const p = s.players[player];
  if (p.lineCount[row] !== row + 1) return null;
  const color = p.lineColor[row] as Color;
  const col = wallCol(row, color);
  p.wall |= bit(row, col);
  const { points, cells } = placementScore(p.wall, row, col);
  p.score += points;
  s.box[color] += row;
  p.lineCount[row] = 0;
  p.lineColor[row] = -1;
  return { player, row, col, color, points, cells, scoreAfter: p.score };
}

/** Aplica la penalización del suelo y lo vacía en la caja. */
export function applyFloor(s: GameState, player: number): FloorPenalty {
  const p = s.players[player];
  const slots = p.floor.length;
  const penalty = floorPenalty(slots);
  p.score = Math.max(0, p.score - penalty);
  for (const t of p.floor) if (t !== FIRST_TOKEN) s.box[t]++;
  p.floor = [];
  return { player, slots, penalty, scoreAfter: p.score };
}

/**
 * Filas que un jugador completará al alicatar esta ronda: líneas de patrón llenas cuya
 * fila del muro ya tiene las otras 4 losetas. Si hay alguna, la partida acaba esta ronda.
 */
export function pendingRowCompletions(p: PlayerState): number[] {
  const rows: number[] = [];
  for (let r = 0; r < 5; r++) {
    if (p.lineCount[r] === r + 1 && rowCount(p.wall, r) === 4) rows.push(r);
  }
  return rows;
}

export function isGameEndTriggered(s: GameState): boolean {
  return s.players.some((p) => completeRows(p.wall) > 0);
}

export function applyBonuses(s: GameState): Bonus[] {
  return s.players.map((p, player) => {
    const rows = completeRows(p.wall);
    const cols = completeCols(p.wall);
    const colors = completeColors(p.wall);
    const points = rows * ROW_BONUS + cols * COL_BONUS + colors * COLOR_BONUS;
    p.score += points;
    return { player, rows, cols, colors, points, scoreAfter: p.score };
  });
}

function tableEmpty(s: GameState): boolean {
  return isRoundOver(s);
}

/**
 * Cierra la ronda tras el alicatado y las penalizaciones: decide el fin de partida
 * o prepara la siguiente ronda.
 */
export function finishRound(s: GameState): { gameOver: boolean; bonuses: Bonus[] } {
  if (s.firstTaker >= 0) s.roundStarter = s.firstTaker;
  if (isGameEndTriggered(s)) {
    s.phase = 'over';
    return { gameOver: true, bonuses: applyBonuses(s) };
  }
  startRound(s);
  if (tableEmpty(s)) {
    // Caso límite: no quedan losetas que repartir. Ver README.
    s.phase = 'over';
    return { gameOver: true, bonuses: applyBonuses(s) };
  }
  return { gameOver: false, bonuses: [] };
}

/** Fin de ronda completo: alicatado (arriba abajo), suelo y preparación. */
export function endRound(s: GameState): RoundSummary {
  const round = s.round;
  const placements: Placement[] = [];
  for (let row = 0; row < 5; row++) {
    for (let p = 0; p < s.numPlayers; p++) {
      const pl = tileLine(s, p, row);
      if (pl) placements.push(pl);
    }
  }
  const penalties: FloorPenalty[] = [];
  for (let p = 0; p < s.numPlayers; p++) penalties.push(applyFloor(s, p));
  const { gameOver, bonuses } = finishRound(s);
  return { round, placements, penalties, gameOver, bonuses };
}
