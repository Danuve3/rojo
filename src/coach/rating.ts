import type { HistoryEntry } from '../storage/history';
import type { ErrorTag } from './types';
import { TAG_INFO } from './verdict';

export interface PlayerRating {
  /** Nota global 0–100. */
  grade: number;
  /** Nivel de bot equivalente (0–10, con decimales). */
  level: number;
  /** Precisión reciente (0–100) o null sin entrenador. */
  accuracy: number | null;
  provisional: boolean;
  title: string;
  paragraphs: string[];
}

/** Pendiente de la curva de victoria por diferencia de nivel (ajustada a los torneos). */
const SLOPE = 0.5;
/** Prior: un jugador nuevo se supone de nivel 3 hasta que demuestre otra cosa. */
const PRIOR_LEVEL = 3;
const PRIOR_WEIGHT = 0.4;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const winProb = (me: number, bot: number) => 1 / (1 + Math.exp(-SLOPE * (me - bot)));

/** Nivel equivalente por máxima verosimilitud (con un prior que tira hacia abajo). */
export function estimateLevel(games: HistoryEntry[]): number {
  const duels = games.flatMap((g) => g.opponents.map((o) => ({ bot: o.level, won: o.beaten })));
  let best = PRIOR_LEVEL;
  let bestLL = -Infinity;
  for (let l = 0; l <= 11.001; l += 0.05) {
    let ll = -PRIOR_WEIGHT * ((l - PRIOR_LEVEL) / 2.5) ** 2;
    for (const d of duels) {
      const p = winProb(l, d.bot);
      ll += Math.log(d.won ? p : 1 - p);
    }
    if (ll > bestLL) {
      bestLL = ll;
      best = l;
    }
  }
  return clamp(best, 0, 10.5);
}

/** Convierte la precisión del entrenador en una puntuación 0–100 (calibrada con los bots). */
export function accuracyScore(acc: number): number {
  // 46 % ≈ juego aleatorio, ~65 % ≈ bots heurísticos, 98 % ≈ MCTS fuerte.
  const pts: Array<[number, number]> = [[0, 0], [45, 12], [55, 30], [65, 48], [75, 64], [85, 80], [95, 94], [100, 100]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (acc <= x1) return y0 + ((acc - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 100;
}

const TITLES: Array<[number, string]> = [
  [90, 'Maestro azulejero'],
  [75, 'Jugador muy fuerte'],
  [60, 'Competidor sólido'],
  [45, 'Jugador de club'],
  [30, 'Aprendiz con ganas'],
  [0, 'Principiante (con mucho margen)'],
];

const CLOSERS: Array<[number, string]> = [
  [90, 'Poco te puedo enseñar ya. Sube el nivel de los bots y que sufran ellos.'],
  [75, 'Juegas bien de verdad. Lo que te separa de la élite son los detalles, y los detalles son lo que más cuesta.'],
  [60, 'Sabes lo que haces la mayor parte del tiempo. El problema es la otra parte.'],
  [45, 'Hay base, pero todavía regalas demasiado. Menos intuición y más contar losetas.'],
  [30, 'Ahora mismo juegas por instinto, y tu instinto no es muy bueno. Usa las pistas sin vergüenza.'],
  [0, 'Siendo honesto: aún no entiendes el juego. La buena noticia es que desde aquí solo se puede subir.'],
];

function pick<T>(table: Array<[number, T]>, v: number): T {
  return (table.find(([min]) => v >= min) ?? table[table.length - 1])[1];
}

function levelName(l: number): string {
  const names = ['', 'Aprendiz', 'Novato', 'Aficionado', 'Jugador', 'Competente', 'Astuto', 'Táctico', 'Experto', 'Maestro', 'Gran maestro'];
  return names[clamp(Math.round(l), 1, 10)];
}

const pct = (n: number) => `${Math.round(n)} %`;

/** Evaluación general como jugador a partir del historial. */
export function ratePlayer(games: HistoryEntry[]): PlayerRating | null {
  if (!games.length) return null;
  const level = estimateLevel(games);
  const coached = games.filter((g) => g.accuracy !== null);
  const recent = coached.slice(-10);
  const accuracy = recent.length ? recent.reduce((a, g) => a + (g.accuracy as number), 0) / recent.length : null;
  const levelScore = clamp((level / 10) * 100, 0, 100);
  let grade = accuracy === null ? levelScore : 0.55 * levelScore + 0.45 * accuracyScore(accuracy);
  const provisional = games.length < 5;
  // Con pocas partidas, la nota se recorta: hay que demostrarlo.
  if (provisional) grade *= 0.6 + 0.08 * games.length;
  grade = Math.round(clamp(grade, 0, 100));

  const paragraphs: string[] = [];
  const wins = games.filter((g) => g.won).length;
  const lv = Math.round(level * 10) / 10;
  paragraphs.push(
    `Con ${games.length} ${games.length === 1 ? 'partida' : 'partidas'} y un ${pct((100 * wins) / games.length)} de victorias, ` +
      `tu juego equivale al de un bot de nivel ${String(lv).replace('.', ',')} (${levelName(level)}).` +
      (level < 3 ? ' Es decir: los bots que eligen casi al azar te ponen en apuros.' : ''),
  );

  // Punto fuerte y debilidad.
  const tagTotals = new Map<ErrorTag, number>();
  for (const g of coached) for (const [t, n] of Object.entries(g.tags) as Array<[ErrorTag, number]>) tagTotals.set(t, (tagTotals.get(t) ?? 0) + n);
  const tags = [...tagTotals.entries()].sort((a, b) => b[1] - a[1]);
  if (accuracy !== null) {
    const mistakes = coached.reduce((a, g) => a + (g.labels.imprecision ?? 0) + (g.labels.error ?? 0) + (g.labels.pifia ?? 0), 0);
    const blunders = coached.reduce((a, g) => a + (g.labels.pifia ?? 0), 0);
    paragraphs.push(
      `Tu precisión reciente es del ${pct(accuracy)}. Cometes ${(mistakes / coached.length).toFixed(1).replace('.', ',')} fallos por partida` +
        (blunders ? `, y ${(blunders / coached.length).toFixed(1).replace('.', ',')} son pifias de las que duelen.` : ', y casi ninguno es grave.'),
    );
    if (tags.length) {
      const [tag, n] = tags[0];
      paragraphs.push(`Tu error más repetido: ${TAG_INFO[tag].name.toLowerCase()} (${n} ${n === 1 ? 'vez' : 'veces'}). ${TAG_INFO[tag].tip}`);
      const absent = (['suelo_evitable', 'regalo_rival', 'linea_bloqueada', 'ignora_bonus'] as ErrorTag[]).filter((t) => !tagTotals.has(t));
      if (absent.length) paragraphs.push(`Lo que sí haces bien: ${TAG_INFO[absent[0]].name.toLowerCase()} no aparece en tu historial. Algo es algo.`);
    }
    if (coached.length >= 6) {
      const half = Math.floor(coached.length / 2);
      const avg = (xs: HistoryEntry[]) => xs.reduce((a, g) => a + (g.accuracy as number), 0) / xs.length;
      const diff = avg(coached.slice(half)) - avg(coached.slice(0, half));
      paragraphs.push(diff > 3
        ? `Vas a mejor: has subido ${Math.round(diff)} puntos de precisión respecto a tus primeras partidas.`
        : diff < -3
          ? `Vas a peor: has perdido ${Math.round(-diff)} puntos de precisión respecto a tus primeras partidas. ¿Juegas con prisa?`
          : 'Tu precisión está estancada: ni mejoras ni empeoras. Toca cambiar algo.');
    }
  } else {
    paragraphs.push('Sin el modo entrenador activado no puedo juzgar tus jugadas, solo tus resultados. Actívalo y te digo exactamente dónde fallas.');
  }
  paragraphs.push(pick(CLOSERS, grade));
  if (provisional) paragraphs.push(`Nota provisional: con menos de 5 partidas no me fío. Juega ${5 - games.length} más y te doy una de verdad.`);
  return { grade, level, accuracy, provisional, title: pick(TITLES, grade), paragraphs };
}
