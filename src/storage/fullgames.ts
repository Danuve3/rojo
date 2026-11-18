import type { MoveEval } from '../coach/replay';
import type { SavedGame } from '../ui/session';
import { deleteRecord, FULLGAMES, getAllKeys, getRecord, putRecord } from './db';

const KEEP = 40;

/** Partida completa guardada para el análisis, con la evaluación por jugada si ya se calculó. */
export interface FullGame {
  game: SavedGame;
  /** Valoración del entrenador de cada jugada (de quien la hizo); índice 0 = primera jugada. */
  moveEvals?: Array<StoredEval | null>;
}

export async function saveFullGame(id: number, game: SavedGame): Promise<void> {
  const slim: SavedGame = { ...game, undo: [] };
  await putRecord(FULLGAMES, { game: slim } satisfies FullGame, id);
  const keys = (await getAllKeys(FULLGAMES)).filter((k): k is number => typeof k === 'number').sort((a, b) => a - b);
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) await deleteRecord(FULLGAMES, k);
}

export function loadFullGame(id: number): Promise<FullGame | undefined> {
  return getRecord<FullGame>(FULLGAMES, id);
}

export type StoredEval = MoveEval & { best?: import('../engine').Move };

export async function saveEvals(id: number, full: FullGame, moveEvals: Array<StoredEval | null>): Promise<void> {
  await putRecord(FULLGAMES, { ...full, moveEvals } satisfies FullGame, id);
}

export async function fullGameIds(): Promise<Set<number>> {
  return new Set((await getAllKeys(FULLGAMES)).filter((k): k is number => typeof k === 'number'));
}
