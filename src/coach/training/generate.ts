import { chooseBotMove } from '../../ai/bot';
import { evaluateWith, prepareEval } from '../../ai/evaluate';
import type { FactorName } from '../../ai/factors';
import { estimateRoundsLeft } from '../../ai/features';
import { cloneState, createRng, type GameState, legalMoves, type Move, newGame, step } from '../../engine';
import type { CoachEngine } from '../engine';
import { topLossFactors } from '../explain';
import { rotateToMe } from './rotate';

export type Theme = 'suelo' | 'adyacencia' | 'bonus' | 'denegacion' | 'ficha' | 'final';

/** Factores que caracterizan cada tema (el que más separa la mejor jugada de la segunda). */
export const THEME_FACTORS: Record<Theme, FactorName[]> = {
  suelo: ['penalizacionSuelo'],
  adyacencia: ['puntosInmediatos', 'adyacenciaFutura'],
  bonus: ['progresoColumna', 'progresoColor', 'progresoFila'],
  denegacion: ['regaloRival'],
  ficha: ['fichaInicial'],
  final: [],
};

export interface Puzzle {
  /** Posición girada: te toca a ti (jugador 0). */
  state: GameState;
  best: Move;
  /** Ventaja de la mejor jugada sobre la segunda (puntos). */
  gap: number;
  theme?: Theme;
}

export interface GenerateOptions {
  seed: number;
  count: number;
  /** Separación mínima entre la mejor jugada y la segunda: más grande = más fácil. */
  minGap: number;
  theme?: Theme;
  timeMs: number;
  analyzeMs: number;
  /** Nivel de los bots que juegan las partidas de las que salen las posiciones. */
  level?: number;
}

/** Filtro rápido con la evaluación heurística antes del análisis caro. */
function promising(s: GameState, theme: Theme | undefined): boolean {
  const moves = legalMoves(s);
  if (moves.length < 4) return false;
  if (theme === 'final' && estimateRoundsLeft(s) > 0) return false;
  const base = prepareEval(s, { rivals: true });
  const evs = moves.map((m) => evaluateWith(base, m, { rivals: true })).sort((a, b) => b.total - a.total);
  if (evs[0].total - evs[1].total < 0.6) return false;
  if (!theme || theme === 'final') return true;
  const diffs = (Object.keys(evs[0].factores) as FactorName[])
    .map((f) => ({ f, d: evs[0].factores[f] - evs[1].factores[f] }))
    .sort((a, b) => b.d - a.d);
  return THEME_FACTORS[theme].includes(diffs[0].f);
}

/**
 * Busca posiciones con una jugada claramente mejor en partidas simuladas entre bots y las
 * confirma con el análisis del entrenador.
 */
export async function generatePuzzles(o: GenerateOptions, coach: CoachEngine): Promise<Puzzle[]> {
  const rnd = createRng(o.seed);
  const out: Puzzle[] = [];
  const deadline = performance.now() + o.timeMs;
  const level = o.level ?? 6;
  while (out.length < o.count && performance.now() < deadline) {
    const players = rnd() < 0.6 ? 2 : 3;
    const s = newGame(players, (rnd() * 0x100000000) | 0, 0);
    while (s.phase === 'playing' && out.length < o.count && performance.now() < deadline) {
      if (s.turn >= 2 && rnd() < 0.35 && promising(s, o.theme)) {
        const a = await coach.analyze(cloneState(s), o.analyzeMs);
        if (a && a.moves.length >= 2) {
          const [best, second] = a.moves;
          const gap = best.value - second.value;
          const top = topLossFactors(second, best)[0]?.f;
          const themeOk = !o.theme || o.theme === 'final' || (top !== undefined && THEME_FACTORS[o.theme].includes(top));
          if (gap >= o.minGap && themeOk) out.push({ state: rotateToMe(s, s.current), best: best.move, gap, theme: o.theme });
        }
      }
      step(s, chooseBotMove(s, level, rnd));
    }
  }
  return out;
}

/**
 * Posición al empezar la última ronda de una partida entre bots, girada para que juegues
 * con alguien que todavía puede ganar.
 */
export function generateFinal(seed: number, players: number): GameState {
  const rnd = createRng(seed);
  const s = newGame(players, (rnd() * 0x100000000) | 0, 0);
  let lastStart = cloneState(s);
  while (s.phase === 'playing') {
    const round = s.round;
    step(s, chooseBotMove(s, 6, rnd));
    if (s.phase === 'playing' && s.round !== round) lastStart = cloneState(s);
  }
  const leader = Math.max(...lastStart.players.map((p) => p.score));
  const contenders = lastStart.players.map((p, i) => ({ p, i })).filter(({ p }) => p.score >= leader - 12);
  const me = contenders[Math.floor(rnd() * contenders.length)].i;
  return rotateToMe(lastStart, me);
}
