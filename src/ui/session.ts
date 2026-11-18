import type { GameState, Move } from '../engine';
import type { MoveRecord } from '../coach/types';
import type { Challenge } from '../coach/challenges';
import type { GameConfig } from './config';

/** Contadores de las ayudas de entrenamiento durante una partida. */
export interface TrainingLog {
  predictions: { n: number; hits: number };
  guesses: { n: number; exact: number; color: number };
  counts: { n: number; correct: number };
  retries: number;
}

export function emptyTrainingLog(): TrainingLog {
  return { predictions: { n: 0, hits: 0 }, guesses: { n: 0, exact: 0, color: 0 }, counts: { n: 0, correct: 0 }, retries: 0 };
}

export interface RoundRecord {
  round: number;
  scores: number[];
}

/** Partida en curso tal y como se guarda en IndexedDB. */
export interface SavedGame {
  version: 1;
  id: string;
  config: GameConfig;
  state: GameState;
  /** Estados antes de cada jugada humana (para deshacer). */
  undo: Array<{ state: GameState; records: number; rounds: number; moves: number }>;
  records: MoveRecord[];
  rounds: RoundRecord[];
  moves: Array<{ player: number; move: Move }>;
  startedAt: number;
  /** Reto activo de la partida (v1.2+). */
  challenge?: Challenge;
  training?: TrainingLog;
}
