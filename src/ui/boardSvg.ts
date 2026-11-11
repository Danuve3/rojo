import { FLOOR_PENALTIES, type PlayerState, wallColor } from '../engine';
import { s } from './dom';
import { tileHref } from './tileArt';

export interface BoardSvgOptions {
  /** Celdas resaltadas del muro (fila*5+col). */
  highlightWall?: number[];
  /** Línea resaltada (o 'floor'). */
  highlightTarget?: number | 'floor' | null;
  width?: number;
}

const C = 20;
const G = 2;

function tile(color: number, x: number, y: number, opacity = 1): SVGElement {
  return s('use', { href: tileHref(color), x, y, width: C, height: C, opacity });
}

/** Tablero de un jugador como SVG estático (rivales ampliados, revisión, reglas). */
export function boardSvg(p: PlayerState, o: BoardSvgOptions = {}): SVGSVGElement {
  const W = 10 * (C + G) + 12;
  const H = 6 * (C + G) + 18;
  const root = s('svg', { viewBox: `0 0 ${W} ${H}`, width: o.width ?? W * 2, class: 'board-svg', role: 'img' });
  root.append(s('rect', { x: 0, y: 0, width: W, height: H, rx: 6, class: 'bs-bg' }));
  const hl = new Set(o.highlightWall ?? []);
  for (let r = 0; r < 5; r++) {
    const y = 4 + r * (C + G);
    for (let k = 0; k <= r; k++) {
      const x = 4 + (4 - k) * (C + G);
      root.append(s('rect', { x, y, width: C, height: C, rx: 3, class: o.highlightTarget === r ? 'bs-slot hl' : 'bs-slot' }));
      if (k < p.lineCount[r]) root.append(tile(p.lineColor[r], x, y));
    }
    for (let c = 0; c < 5; c++) {
      const x = 8 + (5 + c) * (C + G);
      const filled = (p.wall & (1 << (r * 5 + c))) !== 0;
      root.append(tile(wallColor(r, c), x, y, filled ? 1 : 0.2));
      if (hl.has(r * 5 + c)) root.append(s('rect', { x: x - 1, y: y - 1, width: C + 2, height: C + 2, rx: 4, class: 'bs-hl' }));
    }
  }
  const fy = 8 + 5 * (C + G);
  FLOOR_PENALTIES.forEach((pen, k) => {
    const x = 4 + k * (C + G);
    root.append(s('rect', { x, y: fy, width: C, height: C, rx: 3, class: o.highlightTarget === 'floor' ? 'bs-slot hl' : 'bs-slot' }));
    if (k < p.floor.length) root.append(tile(p.floor[k], x, fy));
    else root.append(s('text', { x: x + C / 2, y: fy + C / 2 + 4, class: 'bs-pen', 'text-anchor': 'middle' }, `-${pen}`));
  });
  root.append(s('text', { x: W - 8, y: fy + C / 2 + 5, class: 'bs-score', 'text-anchor': 'end' }, `${p.score} pts`));
  return root;
}
