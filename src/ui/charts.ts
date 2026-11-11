import { h, s } from './dom';

export interface Point {
  x: number;
  y: number;
  /** Texto del tooltip. */
  label: string;
}

export interface LineChartOptions {
  title: string;
  xLabel: (x: number) => string;
  yMin?: number;
  yMax?: number;
  /** Dibuja la línea de cero (ventaja). */
  zero?: boolean;
  ySuffix?: string;
}

const W = 320;
const H = 170;
const PAD = { l: 34, r: 12, t: 12, b: 26 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= step0) ?? step0;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Gráfica de línea de una serie, en SVG propio, con tooltip al pasar el dedo o el ratón. */
export function lineChart(points: Point[], o: LineChartOptions): HTMLElement {
  const ys = points.map((p) => p.y);
  let yMin = o.yMin ?? Math.min(0, ...ys);
  let yMax = o.yMax ?? Math.max(1, ...ys);
  if (o.zero) {
    const m = Math.max(Math.abs(yMin), Math.abs(yMax), 5);
    yMin = Math.min(yMin, -m * 0.25);
    yMax = Math.max(yMax, m * 0.25);
  }
  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const sx = (x: number) => PAD.l + (xMax === xMin ? (W - PAD.l - PAD.r) / 2 : ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r));
  const sy = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': o.title });
  for (const t of niceTicks(yMin, yMax)) {
    svg.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: sy(t), y2: sy(t), class: t === 0 && o.zero ? 'ch-zero' : 'ch-grid' }));
    svg.append(s('text', { x: PAD.l - 6, y: sy(t) + 3.5, class: 'ch-tick', 'text-anchor': 'end' }, `${t}${o.ySuffix ?? ''}`));
  }
  const step = Math.max(1, Math.ceil(points.length / 8));
  points.forEach((p, i) => {
    if (i % step === 0 || i === points.length - 1) {
      svg.append(s('text', { x: sx(p.x), y: H - 8, class: 'ch-tick', 'text-anchor': 'middle' }, o.xLabel(p.x)));
    }
  });
  if (points.length > 1) {
    svg.append(s('path', { d: points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' '), class: 'ch-line' }));
  }
  const dots = points.map((p) => {
    const c = s('circle', { cx: sx(p.x), cy: sy(p.y), r: 4, class: 'ch-dot' }, s('title', {}, p.label));
    svg.append(c);
    return c;
  });
  const last = points[points.length - 1];
  if (last) svg.append(s('text', { x: Math.min(sx(last.x), W - PAD.r), y: sy(last.y) - 9, class: 'ch-val', 'text-anchor': 'end' }, `${Math.round(last.y)}${o.ySuffix ?? ''}`));
  const tip = h('div', { class: 'ch-tip', hidden: true });
  const wrap = h('figure', { class: 'chart-wrap' }, svg, tip, h('figcaption', { class: 'sr-only' }, o.title));
  const hit = s('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
  svg.append(hit);
  const show = (ev: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[best].x) - x)) best = i;
    });
    dots.forEach((d, i) => d.classList.toggle('on', i === best));
    const p = points[best];
    tip.textContent = p.label;
    tip.hidden = false;
    tip.style.left = `${(sx(p.x) / W) * 100}%`;
    tip.style.top = `${(sy(p.y) / H) * 100}%`;
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => {
    tip.hidden = true;
    dots.forEach((d) => d.classList.remove('on'));
  });
  return wrap;
}

export interface Bar {
  label: string;
  value: number;
  detail: string;
}

/** Barras horizontales (0–100 %) con el valor escrito en tinta. */
export function barList(bars: Bar[]): HTMLElement {
  return h('div', { class: 'bars' }, ...bars.map((b) =>
    h('div', { class: 'bar-row', title: b.detail },
      h('span', { class: 'bar-label' }, b.label),
      h('span', { class: 'bar-track' }, (() => {
        const fill = h('span', { class: 'bar-fill' });
        fill.style.width = `${Math.max(2, Math.min(100, b.value))}%`;
        return fill;
      })()),
      h('span', { class: 'bar-val' }, `${Math.round(b.value)}%`),
      h('span', { class: 'bar-detail muted' }, b.detail))));
}
