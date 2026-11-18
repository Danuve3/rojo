import { eloHistory, levelForElo } from '../coach/elo';
import { wallColor } from '../engine';
import type { HistoryEntry } from '../storage/history';
import { barList, lineChart } from './charts';
import { h } from './dom';
import { LEVEL_NAMES } from './screens/setup';
import { tileSvg } from './tileArt';

/** Frecuencia (%) con la que un bot fuerte (nivel 9, 2 jugadores) acaba con cada casilla del muro llena. */
export const STRONG_WALL_HEAT = [100, 100, 100, 100, 99, 64, 83, 94, 84, 61, 45, 70, 68, 65, 41, 30, 46, 50, 30, 25, 20, 18, 34, 20, 10];

export function eloCard(games: HistoryEntry[]): HTMLElement | null {
  const hist = eloHistory(games);
  if (!hist.length) return null;
  const last = hist[hist.length - 1];
  const lvl = levelForElo(last.elo);
  const sign = last.delta > 0 ? '+' : last.delta < 0 ? '−' : '±';
  return h('section', { class: 'card' },
    h('h2', {}, 'Elo'),
    h('div', { class: 'grade-row' },
      h('span', { class: 'grade-num' }, String(last.elo)),
      h('div', { class: 'grade-side' },
        h('b', {}, `${sign}${Math.abs(last.delta)} en la última partida`),
        h('span', { class: 'muted small' }, `A la altura del nivel ${lvl} (${LEVEL_NAMES[lvl]}). Se empieza en 1000.`))),
    hist.length > 1
      ? lineChart(hist.map((p, i) => ({ x: i + 1, y: p.elo, label: `Partida ${i + 1}: ${p.elo} (${p.delta >= 0 ? '+' : ''}${p.delta})` })),
        {
          title: 'Evolución del Elo',
          xLabel: (x) => `#${x}`,
          yMin: Math.floor((Math.min(...hist.map((p) => p.elo)) - 60) / 100) * 100,
          yMax: Math.ceil((Math.max(...hist.map((p) => p.elo)) + 60) / 100) * 100,
        })
      : null);
}

const BUCKET_LABELS: Array<[string, string, string]> = [
  ['apertura', 'Apertura', 'rondas 1–2'],
  ['medio', 'Medio juego', 'rondas intermedias'],
  ['final', 'Final', 'última ronda'],
  ['expositor', 'De un expositor', 'coger de un expositor'],
  ['centro', 'Del centro', 'coger del centro'],
  ['corta', 'Líneas cortas', 'líneas de 1 a 3'],
  ['larga', 'Líneas largas', 'líneas de 4 y 5'],
  ['suelo', 'Directo al suelo', 'tirar todo al suelo'],
];

export function bucketsCard(games: HistoryEntry[]): HTMLElement | null {
  const recent = games.slice(-15);
  const total: Record<string, { n: number; acc: number }> = {};
  for (const g of recent) for (const [k, b] of Object.entries(g.buckets ?? {})) {
    const t = (total[k] ??= { n: 0, acc: 0 });
    t.n += b.n;
    t.acc += b.acc;
  }
  const rows = BUCKET_LABELS.filter(([k]) => total[k]?.n);
  if (!rows.length) return null;
  const all = rows.reduce((a, [k]) => ({ n: a.n + total[k].n, acc: a.acc + total[k].acc }), { n: 0, acc: 0 });
  const mean = all.acc / all.n;
  const solid = rows.filter(([k]) => total[k].n >= 5);
  const weakest = solid.sort((a, b) => total[a[0]].acc / total[a[0]].n - total[b[0]].acc / total[b[0]].n)[0];
  const aids = recent.filter((g) => g.accuracy !== null);
  const noAids = aids.filter((g) => g.training?.noAids);
  const withAids = aids.filter((g) => !g.training?.noAids);
  const avg = (xs: HistoryEntry[]) => xs.reduce((a, g) => a + (g.accuracy as number), 0) / xs.length;
  return h('section', { class: 'card' },
    h('h2', {}, 'Precisión por fase y por decisión'),
    weakest && total[weakest[0]].acc / total[weakest[0]].n < mean - 3
      ? h('p', { class: 'small' }, `Tu punto débil: ${weakest[1].toLowerCase()} (${Math.round(total[weakest[0]].acc / total[weakest[0]].n)} % frente a tu media del ${Math.round(mean)} %).`)
      : h('p', { class: 'small muted' }, `Tu precisión es pareja en todas las fases (media ${Math.round(mean)} %).`),
    barList(rows.map(([k, label, hint]) => ({ label, value: total[k].acc / total[k].n, detail: `${total[k].n} jugadas · ${hint}` })), true),
    noAids.length && withAids.length
      ? h('p', { class: 'small muted' }, `Sin ayudas: ${Math.round(avg(noAids))} % (${noAids.length} partidas). Con ayudas: ${Math.round(avg(withAids))} %.`)
      : null);
}

function heatGrid(title: string, heat: number[]): HTMLElement {
  return h('figure', { class: 'heat' },
    h('div', { class: 'heat-grid' }, ...heat.map((v, i) => {
      const cell = h('div', { class: 'heat-cell', title: `Fila ${Math.floor(i / 5) + 1}, columna ${(i % 5) + 1}: ${v} %` },
        tileSvg(wallColor(Math.floor(i / 5), i % 5)), h('span', {}, `${v}`));
      cell.style.setProperty('--heat', String(v / 100));
      return cell;
    })),
    h('figcaption', {}, title));
}

export function heatmapCard(games: HistoryEntry[]): HTMLElement | null {
  const walls = games.slice(-15).map((g) => g.stats?.finalWall).filter((w): w is number => typeof w === 'number');
  if (walls.length < 1) return null;
  const mine = Array.from({ length: 25 }, (_, i) => Math.round((100 * walls.filter((w) => w & (1 << i)).length) / walls.length));
  const diffs = mine.map((v, i) => ({ i, d: v - STRONG_WALL_HEAT[i] })).sort((a, b) => a.d - b.d);
  const cellName = (i: number) => `fila ${Math.floor(i / 5) + 1}, columna ${(i % 5) + 1}`;
  const under = diffs.filter((x) => x.d <= -25).slice(0, 2);
  const tips: string[] = [];
  if (under.length) tips.push(`Llenas poco la ${under.map((x) => cellName(x.i)).join(' y la ')} (tú ${under.map((x) => mine[x.i]).join(' y ')} %, los bots fuertes ${under.map((x) => STRONG_WALL_HEAT[x.i]).join(' y ')} %).`);
  const topRows = [0, 1].map((r) => mine.slice(r * 5, r * 5 + 5).reduce((a, b) => a + b, 0) / 5);
  if (topRows[0] < 80) tips.push('Los buenos jugadores casi siempre completan la fila de arriba: es la más barata (líneas de 1) y la que cierra la partida.');
  return h('section', { class: 'card' },
    h('h2', {}, 'Mapa de calor de tu muro'),
    h('p', { class: 'small muted' }, `Con qué frecuencia acaba llena cada casilla del muro (últimas ${walls.length} partidas), frente a un bot de nivel 9.`),
    h('div', { class: 'heat-pair' }, heatGrid('Tú', mine), heatGrid('Bots fuertes', STRONG_WALL_HEAT)),
    ...tips.map((t) => h('p', { class: 'small' }, t)));
}
