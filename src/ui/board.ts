import { FLOOR_PENALTIES, wallColor } from '../engine';
import { h } from './dom';
import { floorSlot, lineSlot, wallSlot } from './model';
import { tileSvg } from './tileArt';

export interface BoardView {
  el: HTMLDivElement;
  slots: Map<string, HTMLElement>;
  lines: HTMLDivElement[];
  floor: HTMLDivElement;
  wallCells: HTMLDivElement[];
  score: HTMLSpanElement;
  badges: HTMLSpanElement[];
  floorBadge: HTMLSpanElement;
  head: HTMLDivElement;
  setScore(n: number): void;
  setActive(on: boolean): void;
  /** Marca persistente de quien ha desencadenado el final (con las líneas causantes). */
  setEnder(rows: number[]): void;
}

export interface BoardOptions {
  player: number;
  name: string;
  tag?: string;
  compact: boolean;
}

function slotEl(id: string, slots: Map<string, HTMLElement>, cls = 'slot'): HTMLDivElement {
  const el = h('div', { class: cls, 'data-slot': id });
  slots.set(id, el);
  return el;
}

function buildLines(p: number, slots: Map<string, HTMLElement>, badges: HTMLSpanElement[]): HTMLDivElement[] {
  return [0, 1, 2, 3, 4].map((row) => {
    const line = h('div', { class: 'b-line', 'data-target': String(row), role: 'button', 'aria-label': `Línea ${row + 1}` });
    for (let k = 0; k <= row; k++) line.append(slotEl(lineSlot(p, row, k), slots));
    const badge = h('span', { class: 'line-badge' });
    badges.push(badge);
    line.append(badge);
    return line;
  });
}

function buildWall(p: number, slots: Map<string, HTMLElement>, cells: HTMLDivElement[]): HTMLDivElement {
  const wall = h('div', { class: 'b-wall' });
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = slotEl(wallSlot(p, r, c), slots, 'slot cell');
      cell.append(tileSvg(wallColor(r, c)));
      cells.push(cell);
      wall.append(cell);
    }
  }
  return wall;
}

function buildFloor(p: number, slots: Map<string, HTMLElement>, compact: boolean): HTMLDivElement {
  const floor = h('div', { class: 'b-floor', 'data-target': 'floor', role: 'button', 'aria-label': 'Suelo' });
  FLOOR_PENALTIES.forEach((pen, k) => {
    const el = slotEl(floorSlot(p, k), slots, 'slot fslot');
    if (!compact) el.append(h('span', { class: 'pen' }, `-${pen}`));
    floor.append(el);
  });
  return floor;
}

export function buildBoard(o: BoardOptions): BoardView {
  const slots = new Map<string, HTMLElement>();
  const badges: HTMLSpanElement[] = [];
  const wallCells: HTMLDivElement[] = [];
  const score = h('span', { class: 'b-score', 'aria-label': 'Puntos' }, '0');
  const endFlag = h('span', { class: 'b-end', hidden: true, title: 'Ha desencadenado el final: es la última ronda' }, o.compact ? '🏁' : '🏁 Final');
  const head = h('div', { class: 'b-head' },
    h('span', { class: 'b-name' }, o.name),
    o.tag ? h('span', { class: 'b-tag' }, o.tag) : null,
    endFlag,
    score);
  const lines = buildLines(o.player, slots, badges);
  const floor = buildFloor(o.player, slots, o.compact);
  const floorBadge = h('span', { class: 'floor-badge' });
  floor.append(floorBadge);
  const el = h('div', { class: `board${o.compact ? ' compact' : ''}`, 'data-player': String(o.player) },
    head,
    h('div', { class: 'b-main' }, h('div', { class: 'b-lines' }, ...lines), buildWall(o.player, slots, wallCells)),
    floor);
  return {
    el, slots, lines, floor, wallCells, score, badges, floorBadge, head,
    setScore(n) {
      score.textContent = String(n);
    },
    setActive(on) {
      el.classList.toggle('active', on);
    },
    setEnder(rows) {
      const on = rows.length > 0;
      el.classList.toggle('ender', on);
      endFlag.hidden = !on;
      lines.forEach((l, r) => l.classList.toggle('ending', rows.includes(r)));
    },
  };
}
