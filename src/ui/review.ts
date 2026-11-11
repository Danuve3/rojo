import { accuracyOf, labelCounts } from '../coach/summary';
import { describeMove } from '../coach/explain';
import type { MoveRecord, VerdictLabel } from '../coach/types';
import { LABEL_ICON, LABEL_TEXT } from '../coach/verdict';
import { applyTurn, cloneState, type GameState, type Move } from '../engine';
import { boardSvg } from './boardSvg';
import { lineChart } from './charts';
import { HUMAN } from './config';
import { h } from './dom';
import type { SavedGame } from './session';

const LABELS: VerdictLabel[] = ['excelente', 'buena', 'imprecision', 'error', 'pifia'];

function count(before: GameState, m: Move): number {
  return (m.source === 'center' ? before.center : before.factories[m.source])[m.color];
}

function after(before: GameState, m: Move): GameState {
  const s = cloneState(before);
  applyTurn(s, m);
  return s;
}

function miniReplay(r: MoveRecord): HTMLElement {
  const mine = after(r.before, r.move);
  const best = after(r.before, r.best);
  const col = (title: string, svg: SVGSVGElement, cls = '') => h('figure', { class: `mini ${cls}` }, svg, h('figcaption', {}, title));
  return h('article', { class: `worst ${r.label}` },
    h('header', {}, h('span', { class: `chip ${r.label}` }, `${LABEL_ICON[r.label]} ${LABEL_TEXT[r.label]}`),
      h('span', { class: 'muted small' }, `Ronda ${r.round} · pierdes ~${r.loss.toFixed(1).replace('.', ',')}`)),
    h('p', { class: 'small' }, h('b', {}, 'Jugaste: '), describeMove(r.move, count(r.before, r.move)), h('br'),
      h('b', {}, 'Mejor: '), describeMove(r.best, count(r.before, r.best))),
    h('div', { class: 'minis' },
      col('Antes', boardSvg(r.before.players[HUMAN], { width: 120 })),
      col('Tu jugada', boardSvg(mine.players[HUMAN], { width: 120, highlightTarget: r.move.target }), 'bad'),
      col('Alternativa', boardSvg(best.players[HUMAN], { width: 120, highlightTarget: r.best.target }), 'good')),
    r.reasons.length ? h('ul', { class: 'small' }, ...r.reasons.map((x) => h('li', {}, x))) : null);
}

function advantageChart(g: SavedGame): HTMLElement | null {
  if (!g.rounds.length) return null;
  const pts = g.rounds.map((r) => {
    const mine = r.scores[HUMAN];
    const best = Math.max(...r.scores.filter((_, i) => i !== HUMAN));
    const d = mine - best;
    return { x: r.round, y: d, label: `Ronda ${r.round}: ${d >= 0 ? '+' : ''}${d} (${mine} frente a ${best})` };
  });
  return h('div', {},
    h('h3', { class: 'h3' }, 'Ventaja por ronda'),
    h('p', { class: 'muted small' }, 'Tus puntos menos los del mejor rival al terminar cada ronda (incluye los bonus finales en la última).'),
    lineChart(pts, { title: 'Ventaja por ronda', xLabel: (x) => `R${x}`, zero: true }));
}

/** Revisión de la partida: precisión, categorías, peores jugadas y ventaja por ronda. */
export function reviewSection(g: SavedGame): HTMLElement {
  const acc = accuracyOf(g);
  const counts = labelCounts(g);
  const worst = [...g.records].filter((r) => r.loss > 0.3).sort((a, b) => b.loss - a.loss).slice(0, 3);
  return h('section', { class: 'card review' },
    h('h2', {}, 'Revisión del entrenador'),
    acc === null
      ? h('p', { class: 'muted' }, 'No hay jugadas analizadas.')
      : h('div', { class: 'acc' }, h('span', { class: 'acc-num' }, `${Math.round(acc)}%`), h('span', { class: 'muted' }, `de precisión en ${g.records.length} jugadas`)),
    h('div', { class: 'chips' }, ...LABELS.map((l) => h('span', { class: `chip ${l}` }, `${LABEL_ICON[l]} ${LABEL_TEXT[l]} · ${counts[l] ?? 0}`))),
    worst.length ? h('h3', { class: 'h3' }, 'Tus 3 jugadas más caras') : h('p', { class: 'muted' }, 'Ninguna jugada perdió más de 0,3 puntos. ¡Impecable!'),
    ...worst.map(miniReplay),
    advantageChart(g));
}
