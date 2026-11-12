import { completeRows, winners } from '../engine';
import type { HistoryEntry } from '../storage/history';
import { HUMAN } from '../ui/config';
import type { SavedGame } from '../ui/session';
import type { ErrorTag, VerdictLabel } from './types';
import { type GameStats, replayStats } from './stats';
import { moveAccuracy } from './verdict';

function safeStats(g: SavedGame): GameStats | undefined {
  try {
    const { stats, final } = replayStats(g.state.numPlayers, g.config.seed, g.config.starter, g.moves, HUMAN, g.records);
    // Solo se guardan si la repetición reproduce exactamente la partida.
    return final.players.every((p, i) => p.score === g.state.players[i].score && p.wall === g.state.players[i].wall) ? stats : undefined;
  } catch {
    return undefined;
  }
}

export function accuracyOf(g: SavedGame): number | null {
  if (!g.records.length) return null;
  return g.records.reduce((a, r) => a + moveAccuracy(r.loss), 0) / g.records.length;
}

export function labelCounts(g: SavedGame): Partial<Record<VerdictLabel, number>> {
  const c: Partial<Record<VerdictLabel, number>> = {};
  for (const r of g.records) c[r.label] = (c[r.label] ?? 0) + 1;
  return c;
}

export function tagCounts(g: SavedGame): Partial<Record<ErrorTag, number>> {
  const c: Partial<Record<ErrorTag, number>> = {};
  for (const r of g.records) for (const t of r.tags) c[t] = (c[t] ?? 0) + 1;
  return c;
}

/** Resumen de una partida terminada para el historial. */
export function summarize(g: SavedGame): HistoryEntry {
  const s = g.state;
  const me = s.players[HUMAN];
  const w = winners(s);
  return {
    date: Date.now(),
    players: s.numPlayers,
    opponents: g.config.players
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => i !== HUMAN)
      .map(({ p, i }) => {
        const them = s.players[i];
        const beaten = me.score > them.score || (me.score === them.score && completeRows(me.wall) > completeRows(them.wall));
        return { name: p.name, level: p.level, score: them.score, beaten };
      }),
    myScore: me.score,
    won: w.includes(HUMAN),
    coach: g.config.coach.enabled,
    accuracy: accuracyOf(g),
    analyzed: g.records.length,
    labels: labelCounts(g),
    tags: tagCounts(g),
    rounds: s.round,
    stats: safeStats(g),
    rivalAvg: s.players.filter((_, i) => i !== HUMAN).reduce((a, p) => a + p.score, 0) / (s.numPlayers - 1),
  };
}
