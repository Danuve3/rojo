import type { GameState, Move } from '../engine';
import type { MoveRecord } from '../coach/types';
import type { GameConfig } from './config';

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
}
