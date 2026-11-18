import { colCount, floorPenalty, sum } from '../engine';
import type { HistoryEntry } from '../storage/history';
import { HUMAN } from '../ui/config';
import type { SavedGame } from '../ui/session';
import { type ImprovementId, improvementsFor } from './improvements';
import { replayStats } from './stats';
import { moveAccuracy } from './verdict';

export type ChallengeId = 'floor' | 'cols' | 'ppt' | 'stuck' | 'token' | 'gifts' | 'blocked' | 'points' | 'accuracy';

export interface Challenge {
  id: ChallengeId;
  target: number;
  /** Enunciado corto, p. ej. «Menos de 8 puntos de suelo». */
  title: string;
}

export interface ChallengeProgress {
  /** Texto corto del marcador, p. ej. «Suelo 3/8». */
  short: string;
  /** ok: se cumple; risk: cerca del límite; fail: ya no se puede cumplir; pending: aún no se sabe. */
  status: 'ok' | 'risk' | 'fail' | 'pending';
}

const FROM_IMPROVEMENT: Partial<Record<ImprovementId, Challenge>> = {
  floor: { id: 'floor', target: 8, title: 'Termina con menos de 8 puntos de suelo' },
  bonus: { id: 'cols', target: 1, title: 'Completa al menos una columna (+7)' },
  ppt: { id: 'ppt', target: 3.3, title: 'Saca 3,3 puntos o más por loseta colocada' },
  stuck: { id: 'stuck', target: 2, title: 'Acaba con 2 losetas o menos atascadas en líneas' },
  token: { id: 'token', target: 2, title: 'Llévate la ficha inicial 2 veces como mucho' },
  gifts: { id: 'gifts', target: 1, title: 'Como mucho 1 regalo al rival' },
  blocked: { id: 'blocked', target: 1, title: 'Como mucho 1 línea sin opciones' },
  points: { id: 'points', target: 1, title: 'Como mucho 1 jugada que deja puntos' },
};

const NEEDS_COACH: ChallengeId[] = ['gifts', 'blocked', 'points', 'accuracy'];

/** Elige el reto de la partida a partir del historial: el primer punto convertible en reto. */
export function pickChallenge(history: HistoryEntry[], coach: boolean): Challenge {
  for (const imp of improvementsFor(history, 12)) {
    const ch = FROM_IMPROVEMENT[imp.id];
    if (ch && (coach || !NEEDS_COACH.includes(ch.id))) return ch;
  }
  const accs = history.filter((g) => g.accuracy !== null).slice(-5).map((g) => g.accuracy as number);
  if (coach && accs.length) {
    const target = Math.round(Math.min(95, Math.max(50, accs.reduce((a, b) => a + b, 0) / accs.length + 5)));
    return { id: 'accuracy', target, title: `Supera el ${target} % de precisión` };
  }
  return FROM_IMPROVEMENT.floor as Challenge;
}

function tagCount(g: SavedGame, tag: string): number {
  return g.records.reduce((a, r) => a + (r.tags.includes(tag as never) ? 1 : 0), 0);
}

const f1 = (n: number) => n.toFixed(1).replace('.', ',');

/** Marcador en vivo del reto. */
export function challengeProgress(ch: Challenge, g: SavedGame): ChallengeProgress {
  const me = g.state.players[HUMAN];
  const over = g.state.phase === 'over';
  let stats = null;
  try {
    stats = replayStats(g.state.numPlayers, g.config.seed, g.config.starter, g.moves, HUMAN, g.records).stats;
  } catch {
    stats = null;
  }
  switch (ch.id) {
    case 'floor': {
      const lost = (stats?.floorLost ?? 0) + (over ? 0 : floorPenalty(me.floor.length));
      return { short: `Suelo ${lost}/${ch.target}`, status: lost > ch.target ? 'fail' : lost >= ch.target - 2 ? 'risk' : over ? 'ok' : 'pending' };
    }
    case 'cols': {
      const best = Math.max(...[0, 1, 2, 3, 4].map((c) => colCount(me.wall, c)));
      return { short: `Mejor columna ${best}/5`, status: best >= 5 ? 'ok' : over ? 'fail' : 'pending' };
    }
    case 'ppt': {
      const ppt = stats && stats.tilesPlaced ? stats.placementPoints / stats.tilesPlaced : 0;
      if (!stats || stats.tilesPlaced < 3) return { short: `Puntos/loseta ${stats?.tilesPlaced ? f1(ppt) : '—'}`, status: 'pending' };
      return { short: `Puntos/loseta ${f1(ppt)}`, status: ppt >= ch.target ? (over ? 'ok' : 'pending') : over ? 'fail' : 'risk' };
    }
    case 'stuck': {
      const n = sum(me.lineCount);
      return { short: `A medias ${n}/${ch.target}`, status: n <= ch.target ? (over ? 'ok' : 'pending') : over ? 'fail' : 'risk' };
    }
    case 'token': {
      const n = stats?.firstTokens ?? 0;
      return { short: `Ficha «1» ${n}/${ch.target}`, status: n > ch.target ? 'fail' : n === ch.target ? 'risk' : over ? 'ok' : 'pending' };
    }
    case 'gifts':
    case 'blocked':
    case 'points': {
      const tag = ch.id === 'gifts' ? 'regalo_rival' : ch.id === 'blocked' ? 'linea_bloqueada' : 'puntos_perdidos';
      const n = tagCount(g, tag);
      const label = ch.id === 'gifts' ? 'Regalos' : ch.id === 'blocked' ? 'Líneas sin opciones' : 'Puntos perdidos';
      return { short: `${label} ${n}/${ch.target}`, status: n > ch.target ? 'fail' : n === ch.target ? 'risk' : over ? 'ok' : 'pending' };
    }
    case 'accuracy': {
      if (!g.records.length) return { short: `Precisión —/${ch.target} %`, status: 'pending' };
      const acc = g.records.reduce((a, r) => a + moveAccuracy(r.loss), 0) / g.records.length;
      return { short: `Precisión ${Math.round(acc)}/${ch.target} %`, status: acc >= ch.target ? (over ? 'ok' : 'pending') : over ? 'fail' : 'risk' };
    }
  }
}
