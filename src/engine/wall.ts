import { bit, COLORS, wallCol } from './constants';

export function hasTile(wall: number, row: number, col: number): boolean {
  return (wall & bit(row, col)) !== 0;
}

export function rowHasColor(wall: number, row: number, color: number): boolean {
  return hasTile(wall, row, wallCol(row, color));
}

const ROW_MASKS = [0, 1, 2, 3, 4].map((r) => 0b11111 << (r * 5));
const COL_MASKS = [0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].reduce((m, r) => m | bit(r, c), 0));
const COLOR_MASKS = COLORS.map((color) =>
  [0, 1, 2, 3, 4].reduce((m, r) => m | bit(r, wallCol(r, color)), 0),
);

function popcount(n: number): number {
  let x = n - ((n >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function rowCount(wall: number, row: number): number {
  return popcount(wall & ROW_MASKS[row]);
}
export function colCount(wall: number, col: number): number {
  return popcount(wall & COL_MASKS[col]);
}
export function colorCount(wall: number, color: number): number {
  return popcount(wall & COLOR_MASKS[color]);
}
export function tileCount(wall: number): number {
  return popcount(wall);
}

export function completeRows(wall: number): number {
  return ROW_MASKS.filter((m) => (wall & m) === m).length;
}
export function completeCols(wall: number): number {
  return COL_MASKS.filter((m) => (wall & m) === m).length;
}
export function completeColors(wall: number): number {
  return COLOR_MASKS.filter((m) => (wall & m) === m).length;
}

/**
 * Puntos de una loseta recién colocada en (row, col). `wall` ya la incluye.
 * Aislada: 1. Si no: tramo horizontal (si >=2) + tramo vertical (si >=2).
 */
export function placementScore(wall: number, row: number, col: number): { points: number; cells: number[] } {
  const h: number[] = [row * 5 + col];
  for (let c = col - 1; c >= 0 && hasTile(wall, row, c); c--) h.push(row * 5 + c);
  for (let c = col + 1; c < 5 && hasTile(wall, row, c); c++) h.push(row * 5 + c);
  const v: number[] = [];
  for (let r = row - 1; r >= 0 && hasTile(wall, r, col); r--) v.push(r * 5 + col);
  for (let r = row + 1; r < 5 && hasTile(wall, r, col); r++) v.push(r * 5 + col);
  const hLen = h.length;
  const vLen = v.length + 1;
  if (hLen === 1 && vLen === 1) return { points: 1, cells: [row * 5 + col] };
  const points = (hLen >= 2 ? hLen : 0) + (vLen >= 2 ? vLen : 0);
  const cells = [...(hLen >= 2 ? h : [row * 5 + col]), ...(vLen >= 2 ? v : [])];
  return { points, cells };
}
