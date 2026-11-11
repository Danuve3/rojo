import { s } from './dom';

export const COLOR_NAMES = ['cobalto', 'ocre', 'rojo', 'tinta', 'marfil'] as const;
export const COLOR_NAMES_PLURAL = ['cobaltos', 'ocres', 'rojos', 'tintas', 'marfiles'] as const;
export const COLOR_LABELS = ['Cobalto', 'Ocre', 'Rojo', 'Tinta', 'Marfil'] as const;
export const SYMBOL_NAMES = ['flor', 'rombo', 'estrella', 'anillo', 'celosía'] as const;

interface TileStyle {
  base: string;
  dark: string;
  ink: string;
}

const STYLES: TileStyle[] = [
  { base: '#2a5db0', dark: '#173a7a', ink: '#e9f0ff' },
  { base: '#e3a93a', dark: '#b07617', ink: '#5a3606' },
  { base: '#c8402e', dark: '#8c2414', ink: '#ffe9de' },
  { base: '#33343d', dark: '#16161c', ink: '#e7dccb' },
  { base: '#f3ead7', dark: '#cdbf9f', ink: '#2a5db0' },
];

function symbolPath(color: number, ink: string): SVGElement {
  switch (color) {
    case 0: // flor de cuatro pétalos
      return s('g', { fill: ink },
        s('circle', { cx: 50, cy: 33, r: 13 }), s('circle', { cx: 50, cy: 67, r: 13 }),
        s('circle', { cx: 33, cy: 50, r: 13 }), s('circle', { cx: 67, cy: 50, r: 13 }),
        s('circle', { cx: 50, cy: 50, r: 7, fill: STYLES[0].base }));
    case 1: // rombo con punto
      return s('g', {},
        s('path', { d: 'M50 22 L78 50 L50 78 L22 50 Z', fill: ink }),
        s('circle', { cx: 50, cy: 50, r: 8, fill: STYLES[1].base }));
    case 2: // estrella de ocho puntas
      return s('path', {
        fill: ink,
        d: 'M50 20 L57 37 L71 29 L63 43 L80 50 L63 57 L71 71 L57 63 L50 80 L43 63 L29 71 L37 57 L20 50 L37 43 L29 29 L43 37 Z',
      });
    case 3: // anillos concéntricos
      return s('g', { fill: 'none', stroke: ink, 'stroke-width': 7 },
        s('circle', { cx: 50, cy: 50, r: 23 }), s('circle', { cx: 50, cy: 50, r: 9, fill: ink, stroke: 'none' }));
    default: // celosía
      return s('g', { stroke: ink, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' },
        s('path', { d: 'M30 30 L70 70 M70 30 L30 70' }),
        s('rect', { x: 38, y: 38, width: 24, height: 24, transform: 'rotate(45 50 50)' }));
  }
}

function cornerMotifs(ink: string): SVGElement {
  const r = 14;
  return s('g', { fill: 'none', stroke: ink, 'stroke-width': 3, opacity: 0.55 },
    s('path', { d: `M8 ${8 + r} A${r} ${r} 0 0 0 ${8 + r} 8` }),
    s('path', { d: `M${92 - r} 8 A${r} ${r} 0 0 0 92 ${8 + r}` }),
    s('path', { d: `M92 ${92 - r} A${r} ${r} 0 0 0 ${92 - r} 92` }),
    s('path', { d: `M${8 + r} 92 A${r} ${r} 0 0 0 8 ${92 - r}` }));
}

function tileSymbol(color: number): SVGSymbolElement {
  const st = STYLES[color];
  return s('symbol', { id: `t${color}`, viewBox: '0 0 100 100' },
    s('rect', { x: 2, y: 2, width: 96, height: 96, rx: 12, fill: `url(#g${color})` }),
    s('rect', { x: 7, y: 7, width: 86, height: 86, rx: 8, fill: 'none', stroke: st.ink, 'stroke-width': 2, opacity: 0.45 }),
    cornerMotifs(st.ink),
    symbolPath(color, st.ink),
    s('path', { d: 'M10 30 Q12 10 32 9 L60 9 Q30 14 14 40 Z', fill: '#fff', opacity: 0.28 }));
}

function gradient(color: number): SVGLinearGradientElement {
  const st = STYLES[color];
  return s('linearGradient', { id: `g${color}`, x1: 0, y1: 0, x2: 1, y2: 1 },
    s('stop', { offset: '0', 'stop-color': st.base }),
    s('stop', { offset: '1', 'stop-color': st.dark }));
}

function firstTokenSymbol(): SVGSymbolElement {
  return s('symbol', { id: 'tfirst', viewBox: '0 0 100 100' },
    s('rect', { x: 2, y: 2, width: 96, height: 96, rx: 48, fill: '#fbf6ea', stroke: '#c8402e', 'stroke-width': 6 }),
    s('text', { x: 50, y: 66, 'text-anchor': 'middle', 'font-size': 46, 'font-weight': 700, fill: '#c8402e', 'font-family': 'Georgia, serif' }, '1'));
}

/** Inserta el sprite SVG con el arte de las losetas. */
export function installTileSprite(): void {
  if (document.getElementById('tile-sprite')) return;
  const defs = s('defs', {}, ...[0, 1, 2, 3, 4].map(gradient));
  const sprite = s('svg', { id: 'tile-sprite', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' },
    defs, ...[0, 1, 2, 3, 4].map(tileSymbol), firstTokenSymbol());
  document.body.prepend(sprite);
}

export function tileHref(color: number): string {
  return color === 5 ? '#tfirst' : `#t${color}`;
}

/** SVG con una loseta (para usar en línea). */
export function tileSvg(color: number, size?: number): SVGSVGElement {
  return s('svg', { viewBox: '0 0 100 100', width: size, height: size, class: 'tile-svg', 'aria-hidden': 'true' },
    s('use', { href: tileHref(color) }));
}
