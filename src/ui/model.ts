import { FIRST_TOKEN, type GameState, wallColor } from '../engine';

/** Modelo visual: slot -> color (0..4, o 5 para la ficha inicial). */
export type SlotModel = Map<string, number>;

export function factorySlot(i: number, k: number): string {
  return `f:${i}:${k}`;
}
export function lineSlot(p: number, row: number, k: number): string {
  return `p:${p}:l:${row}:${k}`;
}
export function wallSlot(p: number, row: number, col: number): string {
  return `p:${p}:w:${row}:${col}`;
}
export function floorSlot(p: number, k: number): string {
  return `p:${p}:fl:${k}`;
}

export function modelFromState(s: GameState): SlotModel {
  const m: SlotModel = new Map();
  s.factories.forEach((f, i) => {
    let k = 0;
    for (let c = 0; c < 5; c++) for (let n = 0; n < f[c]; n++) m.set(factorySlot(i, k++), c);
  });
  let k = 0;
  if (s.centerHasFirst) m.set(`c:${k++}`, FIRST_TOKEN);
  for (let c = 0; c < 5; c++) for (let n = 0; n < s.center[c]; n++) m.set(`c:${k++}`, c);
  s.players.forEach((p, pi) => {
    for (let r = 0; r < 5; r++) {
      for (let n = 0; n < p.lineCount[r]; n++) m.set(lineSlot(pi, r, n), p.lineColor[r]);
      for (let c = 0; c < 5; c++) if (p.wall & (1 << (r * 5 + c))) m.set(wallSlot(pi, r, c), wallColor(r, c));
    }
    p.floor.forEach((t, fi) => m.set(floorSlot(pi, fi), t));
  });
  return m;
}

export function centerCount(m: SlotModel): number {
  let n = 0;
  for (const k of m.keys()) if (k.startsWith('c:')) n++;
  return n;
}

export type SlotZone = 'factory' | 'center' | 'line' | 'wall' | 'floor';

export function zoneOf(slot: string): SlotZone {
  if (slot.startsWith('f:')) return 'factory';
  if (slot.startsWith('c:')) return 'center';
  if (slot.includes(':l:')) return 'line';
  if (slot.includes(':w:')) return 'wall';
  return 'floor';
}
