import type { HistoryEntry } from '../storage/history';

/**
 * Elo fijo de cada nivel de bot, ajustado con la matriz de victorias del torneo
 * (2 jugadores, 24 partidas por pareja). Índice = nivel.
 */
export const BOT_ELO = [0, 600, 690, 1080, 1170, 1200, 1240, 1300, 1610, 1710, 1770];
export const START_ELO = 1000;

export interface EloPoint {
  date: number;
  elo: number;
  delta: number;
}

/** Evolución del Elo partida a partida (cada rival cuenta como un duelo). */
export function eloHistory(games: HistoryEntry[]): EloPoint[] {
  let elo = START_ELO;
  const out: EloPoint[] = [];
  games.forEach((g, i) => {
    const k = i < 10 ? 40 : 24;
    let delta = 0;
    for (const o of g.opponents) {
      const rb = BOT_ELO[Math.max(1, Math.min(10, o.level))];
      const expected = 1 / (1 + 10 ** ((rb - elo) / 400));
      delta += (k * ((o.beaten ? 1 : 0) - expected)) / g.opponents.length;
    }
    elo += delta;
    out.push({ date: g.date, elo: Math.round(elo), delta: Math.round(delta) });
  });
  return out;
}

export function currentElo(games: HistoryEntry[]): number {
  const h = eloHistory(games);
  return h.length ? h[h.length - 1].elo : START_ELO;
}

/** Nivel de bot cuyo Elo está más cerca del dado. */
export function levelForElo(elo: number): number {
  let best = 1;
  for (let l = 2; l <= 10; l++) if (Math.abs(BOT_ELO[l] - elo) < Math.abs(BOT_ELO[best] - elo)) best = l;
  return best;
}

/** Niveles para una partida igualada: alrededor del propio Elo. */
export function adaptiveLevels(elo: number, bots: number): number[] {
  const base = levelForElo(elo);
  const spread = bots === 1 ? [0] : bots === 2 ? [-1, 0] : [-1, 0, 1];
  return spread.map((d) => Math.max(1, Math.min(10, base + d)));
}
