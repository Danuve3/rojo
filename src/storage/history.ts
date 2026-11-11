import type { ErrorTag, VerdictLabel } from '../coach/types';
import { addRecord, GAMES, getAll } from './db';

export interface HistoryEntry {
  id?: number;
  date: number;
  players: number;
  opponents: Array<{ name: string; level: number; score: number; beaten: boolean }>;
  myScore: number;
  won: boolean;
  coach: boolean;
  /** Precisión media (0–100) o null si no hubo entrenador. */
  accuracy: number | null;
  analyzed: number;
  labels: Partial<Record<VerdictLabel, number>>;
  tags: Partial<Record<ErrorTag, number>>;
  rounds: number;
}

export function saveHistory(e: HistoryEntry): Promise<void> {
  return addRecord(GAMES, e);
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const all = await getAll<HistoryEntry>(GAMES);
  return all.sort((a, b) => a.date - b.date);
}
