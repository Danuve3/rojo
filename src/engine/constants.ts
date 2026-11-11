import type { Color } from './types';

export const NUM_COLORS = 5;
export const TILES_PER_COLOR = 20;
export const TOTAL_TILES = NUM_COLORS * TILES_PER_COLOR;
export const TILES_PER_FACTORY = 4;
export const FIRST_TOKEN = 5;
export const FLOOR_PENALTIES = [1, 1, 2, 2, 2, 3, 3] as const;
export const FLOOR_SIZE = FLOOR_PENALTIES.length;
export const COLORS: readonly Color[] = [0, 1, 2, 3, 4];
export const ROW_BONUS = 2;
export const COL_BONUS = 7;
export const COLOR_BONUS = 10;

/** Penalización acumulada para k huecos ocupados del suelo. */
export const FLOOR_CUMULATIVE: readonly number[] = FLOOR_PENALTIES.reduce<number[]>(
  (acc, p) => [...acc, acc[acc.length - 1] + p],
  [0],
);

export function factoriesFor(players: number): number {
  return players * 2 + 1;
}

/** muro[fila][col] = COLORES[(col - fila + 5) % 5] */
export function wallColor(row: number, col: number): Color {
  return COLORS[(col - row + 5) % 5];
}

/** Columna en la que va un color en una fila dada. */
export function wallCol(row: number, color: number): number {
  return (color + row) % 5;
}

export function bit(row: number, col: number): number {
  return 1 << (row * 5 + col);
}

export function floorPenalty(slots: number): number {
  return FLOOR_CUMULATIVE[Math.min(slots, FLOOR_SIZE)];
}
