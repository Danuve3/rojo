import type { ErrorTag } from '../../coach/types';
import { ratePlayer } from '../../coach/rating';
import { TAG_INFO } from '../../coach/verdict';
import { type HistoryEntry, loadHistory } from '../../storage/history';
import type { App } from '../app';
import { barList, lineChart } from '../charts';
import { h } from '../dom';
import { screen } from './common';
import { LEVEL_NAMES } from './setup';

function evaluationCard(games: HistoryEntry[]): HTMLElement | null {
  const r = ratePlayer(games);
  if (!r) return null;
  const meter = h('div', { class: 'grade-meter', role: 'img', 'aria-label': `Nota ${r.grade} de 100` }, h('span', { class: 'grade-fill' }));
  (meter.firstChild as HTMLElement).style.width = `${r.grade}%`;
  return h('section', { class: 'card evaluation' },
    h('h2', {}, 'Evaluación del entrenador'),
    h('div', { class: 'grade-row' },
      h('div', { class: 'grade' }, h('span', { class: 'grade-num' }, String(r.grade)), h('span', { class: 'grade-max' }, '/100')),
      h('div', { class: 'grade-side' }, h('b', {}, r.title), r.provisional ? h('span', { class: 'chip' }, 'Provisional') : null)),
    meter,
    ...r.paragraphs.map((p) => h('p', { class: 'eval-p' }, p)));
}

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-val' }, value), h('span', { class: 'muted small' }, label));
}

function accuracySection(games: HistoryEntry[]): HTMLElement {
  const withAcc = games.filter((g) => g.accuracy !== null).slice(-30);
  if (withAcc.length === 0) return h('p', { class: 'muted' }, 'Juega con el entrenador activado para ver tu precisión.');
  const pts = withAcc.map((g, i) => ({
    x: i + 1,
    y: g.accuracy as number,
    label: `${new Date(g.date).toLocaleDateString('es-ES')}: ${Math.round(g.accuracy as number)}% · ${g.won ? 'victoria' : 'derrota'}`,
  }));
  return lineChart(pts, { title: 'Evolución de la precisión', xLabel: (x) => `#${x}`, yMin: 0, yMax: 100, ySuffix: '%' });
}

function levelSection(games: HistoryEntry[]): HTMLElement {
  const by = new Map<number, { n: number; w: number }>();
  for (const g of games) for (const o of g.opponents) {
    const e = by.get(o.level) ?? { n: 0, w: 0 };
    e.n++;
    if (o.beaten) e.w++;
    by.set(o.level, e);
  }
  const levels = [...by.keys()].sort((a, b) => a - b);
  if (!levels.length) return h('p', { class: 'muted' }, 'Sin datos todavía.');
  return barList(levels.map((l) => {
    const e = by.get(l) as { n: number; w: number };
    return { label: `Nv ${l}`, value: (100 * e.w) / e.n, detail: `${e.w}/${e.n} · ${LEVEL_NAMES[l]}` };
  }));
}

function errorsSection(games: HistoryEntry[]): HTMLElement {
  const coached = games.filter((g) => g.coach && g.analyzed > 0);
  const totals = new Map<ErrorTag, number>();
  for (const g of coached) for (const [t, n] of Object.entries(g.tags) as Array<[ErrorTag, number]>) totals.set(t, (totals.get(t) ?? 0) + n);
  const list = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (!list.length) return h('p', { class: 'muted' }, coached.length ? 'Sin errores recurrentes. ¡Sigue así!' : 'Juega con el entrenador para detectar patrones.');
  return h('ol', { class: 'errors' }, ...list.map(([tag, n]) => h('li', {},
    h('div', { class: 'err-head' }, h('b', {}, TAG_INFO[tag].name), h('span', { class: 'muted small' }, `${n} ${n === 1 ? 'vez' : 'veces'} · ${(n / coached.length).toFixed(1).replace('.', ',')} por partida`)),
    h('p', { class: 'small' }, TAG_INFO[tag].tip))));
}

export function progressScreen(root: HTMLElement, app: App): void {
  const body = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Cargando…'));
  root.append(screen('Progreso', app, body));
  void loadHistory().then((games) => {
    if (!games.length) {
      body.replaceChildren(h('section', { class: 'card' }, h('p', {}, 'Aún no has terminado ninguna partida. Cuando lo hagas, aquí verás tu evolución.')));
      return;
    }
    const wins = games.filter((g) => g.won).length;
    const avg = games.reduce((a, g) => a + g.myScore, 0) / games.length;
    const accs = games.filter((g) => g.accuracy !== null).slice(-10);
    const acc = accs.length ? accs.reduce((a, g) => a + (g.accuracy as number), 0) / accs.length : null;
    body.replaceChildren(...[
      evaluationCard(games),
      h('section', { class: 'card stats' },
        stat('partidas', String(games.length)),
        stat('victorias', `${Math.round((100 * wins) / games.length)}%`),
        stat('puntos de media', avg.toFixed(0)),
        stat('precisión (últimas 10)', acc === null ? '—' : `${Math.round(acc)}%`)),
      h('section', { class: 'card' }, h('h2', {}, 'Precisión'), accuracySection(games)),
      h('section', { class: 'card' }, h('h2', {}, 'Victorias por nivel de rival'), h('p', { class: 'muted small' }, 'Partidas en las que acabaste por delante de un rival de ese nivel.'), levelSection(games)),
      h('section', { class: 'card' }, h('h2', {}, 'Errores recurrentes'), errorsSection(games)),
    ].filter((x): x is HTMLElement => x !== null));
  });
}
