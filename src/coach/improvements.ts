import type { HistoryEntry } from '../storage/history';
import type { GameStats } from './stats';

export interface Improvement {
  title: string;
  detail: string;
  /** Puntos por partida que se estima que cuesta (para ordenar). */
  cost: number;
}

const f1 = (n: number) => n.toFixed(1).replace('.', ',');
const pct = (n: number) => `${Math.round(n * 100)} %`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Umbrales calibrados con partidas de bots (2 jugadores contra nivel 5): los bots fuertes
 * sacan 3,6–4,3 puntos por loseta colocada, dejan 2–3 losetas atascadas y el MCTS pierde
 * unos 8–9 puntos por partida en el suelo.
 */
function fromStats(entries: HistoryEntry[]): Improvement[] {
  const st = entries.map((e) => e.stats as GameStats);
  const out: Improvement[] = [];
  const floor = mean(st.map((s) => s.floorLost));
  const tiles = mean(st.map((s) => s.tilesToFloor));
  if (floor > 10) {
    out.push({
      title: 'Deja de alimentar el suelo',
      detail: `Pierdes ${f1(floor)} puntos por partida en el suelo (${f1(tiles)} losetas). Objetivo: menos de 8. Antes de confirmar, mira el aviso «⬇N» de cada línea, y al final de la ronda coge montones de 1–2 losetas aunque den poco.`,
      cost: floor - 8,
    });
  }
  const bonus = mean(st.map((s) => s.bonusPoints));
  const cols = mean(st.map((s) => s.colsDone));
  const colors = mean(st.map((s) => s.colorsDone));
  if (bonus < 10) {
    out.push({
      title: 'Juega a por los bonus',
      detail: `Sacas ${f1(bonus)} puntos de bonus por partida (${f1(cols)} columnas y ${f1(colors)} colores completos de media). Desde la ronda 2, elige una columna central y ciérrala: son 7 puntos que tus rivales no ven venir.`,
      cost: (12 - bonus) * 0.6,
    });
  }
  const placed = st.reduce((a, s) => a + s.tilesPlaced, 0);
  const ppt = placed ? st.reduce((a, s) => a + s.placementPoints, 0) / placed : 0;
  if (placed && ppt < 3.3) {
    out.push({
      title: 'Coloca pegado a lo que ya tienes',
      detail: `Cada loseta te da ${f1(ppt)} puntos al colocarse: tu muro está demasiado suelto. Los buenos jugadores pasan de 3,5. Empieza por la casilla central (fila 3, columna 3) y crece en cruz.`,
      cost: (3.3 - ppt) * (placed / st.length) * 0.5,
    });
  }
  const stuck = mean(st.map((s) => s.stuckTiles));
  if (stuck > 3.5) {
    out.push({
      title: 'No empieces líneas que no vas a cerrar',
      detail: `Acabas las partidas con ${f1(stuck)} losetas atascadas en líneas incompletas. En la última ronda, antes de abrir una línea de 4 o 5, cuenta cuántas losetas de ese color quedan en la mesa.`,
      cost: (stuck - 2.5) * 0.8,
    });
  }
  const rounds = st.reduce((a, s) => a + s.rounds, 0);
  const tokenRate = rounds ? st.reduce((a, s) => a + s.firstTokens, 0) / rounds : 0;
  // Por puro reparto, la ficha cae en tu lado 1 de cada N rondas.
  const expected = mean(entries.map((e) => 1 / e.players));
  if (tokenRate > Math.min(0.8, expected * 1.5)) {
    out.push({
      title: 'Suelta la ficha inicial',
      detail: `Te llevas la ficha «1» en el ${pct(tokenRate)} de las rondas, y cada vez cuesta 1 o 2 puntos de suelo. Cógela solo cuando el montón del centro te complete una línea o empezar la ronda sea clave.`,
      cost: (tokenRate - expected) * 4,
    });
  }
  const last = st.filter((s) => s.lossLastRound !== null && s.lossEarlier !== null);
  if (last.length) {
    const a = mean(last.map((s) => s.lossLastRound as number));
    const b = mean(last.map((s) => s.lossEarlier as number));
    if (a > 1 && a > b * 1.4) {
      out.push({
        title: 'Aprende a cerrar partidas',
        detail: `En la última ronda tu juego se hunde: pierdes ${f1(a)} puntos por jugada frente a ${f1(b)} en el resto. Al final, cuenta qué queda en la mesa y quién se va a tragar las sobras, y prioriza bonus sobre líneas nuevas.`,
        cost: (a - b) * 4,
      });
    }
  }
  const badEnds = st.filter((s) => s.endedGame && !s.aheadAtEnd).length;
  if (badEnds >= 2 && badEnds / st.length >= 0.3) {
    out.push({
      title: 'No cierres la partida cuando vas perdiendo',
      detail: `En ${badEnds} de ${st.length} partidas completaste la fila que terminó el juego yendo por detrás. Si vas perdiendo, deja la quinta loseta de esa fila para más tarde y alarga la partida.`,
      cost: 3,
    });
  }
  return out;
}

function fromTags(games: HistoryEntry[]): Improvement[] {
  const coached = games.filter((g) => g.coach && g.analyzed > 0);
  if (!coached.length) return [];
  const per = (tag: keyof HistoryEntry['tags']) => coached.reduce((a, g) => a + (g.tags[tag] ?? 0), 0) / coached.length;
  const out: Improvement[] = [];
  const gifts = per('regalo_rival');
  if (gifts >= 0.8) {
    out.push({
      title: 'Mira el tablero de tus rivales antes de coger',
      detail: `Les regalas jugadas ${f1(gifts)} veces por partida. Antes de coger de un expositor, mira qué cae al centro y si completa la línea de alguien. Toca su tablero para verlo en grande.`,
      cost: gifts * 1.5,
    });
  }
  const blocked = per('linea_bloqueada');
  if (blocked >= 0.8) {
    out.push({
      title: 'Cuenta las losetas que quedan',
      detail: `${f1(blocked)} veces por partida dejas líneas sin opciones reales de completarse. Antes de empezar una línea, comprueba que quedan suficientes losetas de ese color en la mesa.`,
      cost: blocked * 1.2,
    });
  }
  const pts = per('puntos_perdidos');
  if (pts >= 1) {
    out.push({
      title: 'No dejes pasar las jugadas que puntúan',
      detail: `${f1(pts)} veces por partida eliges una jugada que da menos puntos que otra igual de segura. Antes de confirmar, pulsa 💡 de vez en cuando para comparar.`,
      cost: pts,
    });
  }
  return out;
}

function difficulty(games: HistoryEntry[]): Improvement[] {
  const recent = games.slice(-8);
  const duels = recent.flatMap((g) => g.opponents);
  if (duels.length < 4) return [];
  const byLevel = new Map<number, { n: number; w: number }>();
  for (const o of duels) {
    const e = byLevel.get(o.level) ?? { n: 0, w: 0 };
    e.n++;
    if (o.beaten) e.w++;
    byLevel.set(o.level, e);
  }
  const [level, e] = [...byLevel.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  if (e.n >= 4 && e.w / e.n >= 0.75 && level < 10) {
    return [{ title: 'Sube la dificultad', detail: `Ganas el ${pct(e.w / e.n)} de las veces al nivel ${level}: ahí ya no aprendes nada. Prueba el nivel ${level + 1}.`, cost: 2 }];
  }
  if (e.n >= 4 && e.w / e.n <= 0.15 && level > 1) {
    return [{ title: 'Baja un nivel y consolida', detail: `Contra el nivel ${level} solo ganas el ${pct(e.w / e.n)}. Baja al ${level - 1} con el entrenador activado hasta ganar la mitad, y luego vuelve.`, cost: 2 }];
  }
  return [];
}

/** Lista de cosas concretas a mejorar, ordenada por los puntos que cuestan. */
export function improvementsFor(games: HistoryEntry[], max = 6): Improvement[] {
  const recent = games.slice(-10);
  const withStats = recent.filter((g) => !!g.stats);
  const items = [...(withStats.length ? fromStats(withStats) : []), ...fromTags(recent), ...difficulty(games)];
  const seen = new Set<string>();
  return items
    .sort((a, b) => b.cost - a.cost)
    .filter((i) => !seen.has(i.title) && seen.add(i.title))
    .slice(0, max);
}
