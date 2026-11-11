import { h } from './dom';
import { factorySlot } from './model';
import type { SlotRect } from './tileLayer';

export interface TableView {
  el: HTMLDivElement;
  slots: Map<string, HTMLElement>;
  factories: HTMLDivElement[];
  center: HTMLDivElement;
  bag: HTMLDivElement;
  box: HTMLDivElement;
  bagCount: HTMLSpanElement;
  boxCount: HTMLSpanElement;
  layout(): void;
  centerRect(k: number, n: number, origin: DOMRect): SlotRect | null;
}

/** Mesa: expositores en elipse alrededor del centro. */
export function buildTable(numFactories: number): TableView {
  const slots = new Map<string, HTMLElement>();
  const factories = Array.from({ length: numFactories }, (_, i) => {
    const f = h('div', { class: 'factory', 'data-source': String(i), 'aria-label': `Expositor ${i + 1}` });
    for (let k = 0; k < 4; k++) {
      const sl = h('div', { class: 'slot', 'data-slot': factorySlot(i, k) });
      slots.set(factorySlot(i, k), sl);
      f.append(sl);
    }
    return f;
  });
  const center = h('div', { class: 'center', 'data-source': 'center', 'aria-label': 'Centro de la mesa' });
  const bagCount = h('span', {}, '0');
  const boxCount = h('span', {}, '0');
  const bag = h('div', { class: 'pile bag', title: 'Bolsa' }, h('span', { class: 'pile-icon' }, '👜'), bagCount);
  const box = h('div', { class: 'pile box', title: 'Caja de descartes' }, h('span', { class: 'pile-icon' }, '📦'), boxCount);
  const el = h('div', { class: 'table' }, center, ...factories, bag, box);
  let tileSize = 30;

  function layout(): void {
    const w = el.clientWidth;
    const hgt = el.clientHeight;
    if (w === 0 || hgt === 0) return;
    const n = numFactories;
    const k = n <= 5 ? 0.34 : n <= 7 ? 0.28 : 0.235;
    const d = Math.min(Math.min(w, hgt * 1.25) * k, 130);
    tileSize = d * 0.38;
    const rx = (w - d) / 2 - 2;
    const ry = (hgt - d) / 2 - 2;
    factories.forEach((f, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = w / 2 + rx * Math.cos(a) - d / 2;
      const y = hgt / 2 + ry * Math.sin(a) - d / 2;
      f.style.cssText = `width:${d}px;height:${d}px;transform:translate(${x}px,${y}px)`;
    });
    const cw = Math.max(40, (rx - d / 2) * 2 * 0.86);
    const ch = Math.max(40, (ry - d / 2) * 2 * 0.86);
    center.style.cssText = `width:${cw}px;height:${ch}px;transform:translate(${(w - cw) / 2}px,${(hgt - ch) / 2}px)`;
    el.style.setProperty('--ft', `${tileSize}px`);
  }

  function centerRect(k: number, n: number, origin: DOMRect): SlotRect | null {
    const r = center.getBoundingClientRect();
    if (r.width === 0) return null;
    const count = Math.max(n, 1);
    let best = { size: 0, cols: 1 };
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const size = Math.min(r.width / cols, r.height / rows);
      if (size > best.size) best = { size, cols };
    }
    const cell = Math.min(best.size, tileSize * 1.25);
    const size = Math.min(cell * 0.9, tileSize);
    const rows = Math.ceil(count / best.cols);
    const lastCols = count - (rows - 1) * best.cols;
    const row = Math.floor(k / best.cols);
    const colsInRow = row === rows - 1 ? lastCols : best.cols;
    const col = k % best.cols;
    const x0 = r.left - origin.left + (r.width - colsInRow * cell) / 2;
    const y0 = r.top - origin.top + (r.height - rows * cell) / 2;
    return { x: x0 + col * cell + (cell - size) / 2, y: y0 + row * cell + (cell - size) / 2, size };
  }

  return { el, slots, factories, center, bag, box, bagCount, boxCount, layout, centerRect };
}
