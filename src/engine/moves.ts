import { FIRST_TOKEN, FLOOR_SIZE } from './constants';
import type { Color, GameState, Move, PlayerState, Target, TurnResult } from './types';
import { rowHasColor } from './wall';

export function canPlaceInLine(p: PlayerState, row: number, color: number): boolean {
  const lc = p.lineColor[row];
  if (lc !== -1 && lc !== color) return false;
  if (p.lineCount[row] >= row + 1) return false;
  return !rowHasColor(p.wall, row, color);
}

export function validTargets(p: PlayerState, color: number): Target[] {
  const t: Target[] = [];
  for (let row = 0; row < 5; row++) if (canPlaceInLine(p, row, color)) t.push(row as Target);
  t.push('floor');
  return t;
}

/** Jugadas legales, sin duplicados por expositores de contenido idéntico. */
export function legalMoves(s: GameState): Move[] {
  if (s.phase !== 'playing') return [];
  const p = s.players[s.current];
  const out: Move[] = [];
  const targets: Target[][] = [];
  for (let c = 0; c < 5; c++) targets.push(validTargets(p, c));
  const seen = new Set<string>();
  s.factories.forEach((f, i) => {
    let any = false;
    for (let c = 0; c < 5; c++) if (f[c] > 0) any = true;
    if (!any) return;
    const key = f.join(',');
    if (seen.has(key)) return;
    seen.add(key);
    for (let c = 0; c < 5; c++) {
      if (f[c] === 0) continue;
      for (const target of targets[c]) out.push({ source: i, color: c as Color, target });
    }
  });
  for (let c = 0; c < 5; c++) {
    if (s.center[c] === 0) continue;
    for (const target of targets[c]) out.push({ source: 'center', color: c as Color, target });
  }
  return out;
}

export function isLegal(s: GameState, m: Move): boolean {
  if (s.phase !== 'playing') return false;
  const src = m.source === 'center' ? s.center : s.factories[m.source];
  if (!src || !(src[m.color] > 0)) return false;
  if (m.target === 'floor') return true;
  return canPlaceInLine(s.players[s.current], m.target, m.color);
}

export function moveKey(m: Move): string {
  return `${m.source}|${m.color}|${m.target}`;
}

export function sameMove(a: Move, b: Move): boolean {
  return a.source === b.source && a.color === b.color && a.target === b.target;
}

/** Aplica el turno (sin cerrar la ronda). Muta el estado. */
export function applyTurn(s: GameState, m: Move): TurnResult {
  const player = s.current;
  const p = s.players[player];
  const toCenter = [0, 0, 0, 0, 0];
  let taken: number;
  let tookFirst = false;
  if (m.source === 'center') {
    taken = s.center[m.color];
    s.center[m.color] = 0;
    if (s.centerHasFirst) {
      s.centerHasFirst = false;
      tookFirst = true;
      s.firstTaker = player;
      if (p.floor.length < FLOOR_SIZE) p.floor.push(FIRST_TOKEN);
    }
  } else {
    const f = s.factories[m.source];
    taken = f[m.color];
    f[m.color] = 0;
    for (let c = 0; c < 5; c++) {
      toCenter[c] = f[c];
      s.center[c] += f[c];
      f[c] = 0;
    }
  }
  let toLine = 0;
  if (m.target !== 'floor') {
    const row = m.target;
    toLine = Math.min(row + 1 - p.lineCount[row], taken);
    p.lineColor[row] = m.color;
    p.lineCount[row] += toLine;
  }
  const overflow = taken - toLine;
  const toFloor = Math.min(overflow, FLOOR_SIZE - p.floor.length);
  for (let i = 0; i < toFloor; i++) p.floor.push(m.color);
  const toBox = overflow - toFloor;
  s.box[m.color] += toBox;
  s.current = (s.current + 1) % s.numPlayers;
  s.turn++;
  return { move: m, player, taken, toLine, toFloor, toBox, tookFirst, toCenter };
}
