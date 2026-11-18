import { cloneState, type GameState, type Move, newGame, step, type TurnResult } from '../engine';

export interface ReplayStep {
  /** Estado tras la jugada (y tras el alicatado si cerró la ronda). */
  state: GameState;
  move: Move;
  player: number;
  turn: TurnResult;
  /** Estado justo antes de la jugada. */
  before: GameState;
}

/**
 * Reconstruye todas las posiciones de una partida a partir de su semilla y sus jugadas.
 * Devuelve null si la reconstrucción no coincide con el final guardado.
 */
export function replayPositions(
  numPlayers: number,
  seed: number,
  starter: number,
  moves: Array<{ player: number; move: Move }>,
  finalState?: GameState,
): { start: GameState; steps: ReplayStep[] } | null {
  const s = newGame(numPlayers, seed, starter);
  const start = cloneState(s);
  const steps: ReplayStep[] = [];
  for (const { move } of moves) {
    if (s.phase !== 'playing') return null;
    const before = cloneState(s);
    const player = s.current;
    try {
      const { turn } = step(s, move, true);
      steps.push({ state: cloneState(s), move, player, turn, before });
    } catch {
      return null;
    }
  }
  if (finalState && finalState.players.some((p, i) => p.score !== s.players[i].score || p.wall !== s.players[i].wall)) return null;
  return { start, steps };
}

export type MomentKind = 'tu_error' | 'tu_acierto' | 'golpe_rival' | 'regalo_rival';

/** Valoración de una jugada por el entrenador (desde el punto de vista de quien la hizo). */
export interface MoveEval {
  /** Puntos que pierde frente a la mejor jugada. */
  loss: number;
  /** Ventaja de la mejor sobre la segunda: grande = jugada única. */
  gap: number;
}

export interface CriticalMoment {
  /** Índice de la jugada (1 = primera). */
  index: number;
  player: number;
  /** Magnitud en puntos: lo perdido (error) o lo que se evitó perder (jugada única). */
  size: number;
  kind: MomentKind;
}

/**
 * Balance de errores tras cada jugada (índice 0 = inicio): baja con tus errores y sube con
 * los de los rivales (repartidos entre los demás jugadores).
 */
export function errorBalance(evals: Array<MoveEval | null>, players: number[], me: number, numPlayers: number): number[] {
  const out = [0];
  let b = 0;
  evals.forEach((e, k) => {
    if (e) b += players[k] === me ? -e.loss : e.loss / Math.max(1, numPlayers - 1);
    out.push(b);
  });
  return out;
}

const ONLY_MOVE = 2;

/** Los errores más caros y las jugadas únicas más importantes, tuyas y de los rivales. */
export function criticalMoments(evals: Array<MoveEval | null>, players: number[], me: number, max = 3): CriticalMoment[] {
  const out: CriticalMoment[] = [];
  evals.forEach((e, k) => {
    if (!e) return;
    const mine = players[k] === me;
    if (e.loss >= 1) out.push({ index: k + 1, player: players[k], size: e.loss, kind: mine ? 'tu_error' : 'regalo_rival' });
    else if (e.loss <= 0.3 && e.gap >= ONLY_MOVE) out.push({ index: k + 1, player: players[k], size: e.gap, kind: mine ? 'tu_acierto' : 'golpe_rival' });
  });
  return out.sort((a, b) => b.size - a.size).slice(0, max).sort((a, b) => a.index - b.index);
}
