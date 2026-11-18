import type { GameStats } from '../coach/stats';
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
  /** Estadísticas detalladas (partidas guardadas desde la versión con mejoras concretas). */
  stats?: GameStats;
  /** Puntuación media de los rivales. */
  rivalAvg?: number;
  /** Precisión por fase y tipo de decisión: suma de precisiones y número de jugadas (v1.3+). */
  buckets?: Record<string, { n: number; acc: number }>;
  /** Ayudas de entrenamiento (v1.2+). */
  training?: {
    challenge?: { id: string; title: string; done: boolean };
    noAids?: boolean;
    predictions?: { n: number; hits: number };
    guesses?: { n: number; exact: number; color: number };
    counts?: { n: number; correct: number };
    retries?: number;
  };
}

/** Guarda la entrada del historial y devuelve su clave. */
export async function saveHistory(e: HistoryEntry): Promise<number | null> {
  const key = await addRecord(GAMES, e);
  return typeof key === 'number' ? key : null;
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const all = await getAll<HistoryEntry>(GAMES);
  return all.sort((a, b) => a.date - b.date);
}
