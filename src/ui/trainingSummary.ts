import { challengeProgress } from '../coach/challenges';
import type { HistoryEntry } from '../storage/history';
import { h } from './dom';
import type { SavedGame } from './session';

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—');

function row(label: string, value: string, detail: string): HTMLElement {
  return h('div', { class: 'tr-row' }, h('span', {}, label), h('b', {}, value), h('span', { class: 'muted small' }, detail));
}

/** Tarjeta del final de partida: reto y ayudas de entrenamiento usadas. */
export function trainingCard(g: SavedGame): HTMLElement | null {
  const t = g.training;
  const rows: HTMLElement[] = [];
  if (g.challenge && g.config.training?.challenge !== false) {
    const p = challengeProgress(g.challenge, g);
    const done = p.status === 'ok';
    rows.push(h('div', { class: `tr-challenge ${done ? 'ok' : 'fail'}` },
      h('b', {}, done ? '🎯 Reto cumplido' : '🎯 Reto no cumplido'),
      h('span', {}, `${g.challenge.title} · ${p.short}`)));
  }
  if (t?.predictions.n) rows.push(row('Predicciones', pct(t.predictions.hits, t.predictions.n), `${t.predictions.hits} de ${t.predictions.n} candidatas a la altura de la mejor`));
  if (t?.guesses.n) rows.push(row('Lectura del rival', pct(t.guesses.exact, t.guesses.n), `${t.guesses.exact} exactas y ${t.guesses.color} con el color bien, de ${t.guesses.n}`));
  if (t?.counts.n) rows.push(row('Conteo', pct(t.counts.correct, t.counts.n), `${t.counts.correct} de ${t.counts.n} respuestas correctas`));
  if (t?.retries) rows.push(row('Reintentos', String(t.retries), 'jugadas corregidas con la segunda oportunidad'));
  if (!rows.length) return null;
  return h('section', { class: 'card training' }, h('h2', {}, 'Entrenamiento'), ...rows);
}

/** Resumen acumulado para la pantalla de progreso. */
export function trainingProgress(games: HistoryEntry[]): HTMLElement | null {
  const tr = games.map((g) => g.training).filter((t): t is NonNullable<HistoryEntry['training']> => !!t);
  const sumOf = (f: (t: NonNullable<HistoryEntry['training']>) => [number, number] | null) =>
    tr.reduce((acc, t) => {
      const v = f(t);
      return v ? [acc[0] + v[0], acc[1] + v[1]] : acc;
    }, [0, 0]);
  const ch = sumOf((t) => (t.challenge ? [t.challenge.done ? 1 : 0, 1] : null));
  const pr = sumOf((t) => (t.predictions ? [t.predictions.hits, t.predictions.n] : null));
  const gu = sumOf((t) => (t.guesses ? [t.guesses.exact, t.guesses.n] : null));
  const co = sumOf((t) => (t.counts ? [t.counts.correct, t.counts.n] : null));
  const rows: HTMLElement[] = [];
  if (ch[1]) rows.push(row('Retos cumplidos', pct(ch[0], ch[1]), `${ch[0]} de ${ch[1]} partidas`));
  if (pr[1]) rows.push(row('Predicciones acertadas', pct(pr[0], pr[1]), `${pr[0]} de ${pr[1]}`));
  if (gu[1]) rows.push(row('Lectura del rival', pct(gu[0], gu[1]), `${gu[0]} exactas de ${gu[1]}`));
  if (co[1]) rows.push(row('Conteo', pct(co[0], co[1]), `${co[0]} de ${co[1]}`));
  if (!rows.length) return null;
  return h('section', { class: 'card training' }, h('h2', {}, 'Entrenamiento'), ...rows);
}
