import type { Puzzle } from '../coach/training/generate';
import { type Card, isLearned } from '../coach/training/srs';
import { CARDS, getAll, getRecord, kvGet, kvSet, putRecord } from './db';

// ---------- repaso de errores ----------

export function saveCard(c: Card): Promise<void> {
  return putRecord(CARDS, c);
}

export async function loadCards(): Promise<Card[]> {
  return getAll<Card>(CARDS);
}

export async function hasCard(id: string): Promise<boolean> {
  return (await getRecord<Card>(CARDS, id)) !== undefined;
}

export function cardStats(cards: Card[], now = Date.now()): { due: number; learning: number; learned: number } {
  return {
    due: cards.filter((c) => c.due <= now).length,
    learning: cards.filter((c) => !isLearned(c)).length,
    learned: cards.filter(isLearned).length,
  };
}

// ---------- puzle del día ----------

export interface DailyState {
  /** Día (AAAA-MM-DD) de los puzles guardados. */
  day: string;
  puzzles: Array<Puzzle & { result?: 'ok' | 'fail' }>;
  /** Días seguidos con al menos un puzle resuelto, y el último de ellos. */
  streak: number;
  lastSolvedDay: string | null;
  /** Dificultad de 1 a 5 (sube si resuelves, baja si no). */
  difficulty: number;
}

/** Separación mínima entre la mejor jugada y la segunda para cada dificultad (1 = muy clara). */
export const DIFFICULTY_GAP = [0, 2, 1.5, 1.2, 1, 0.8];

export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return today(new Date(y, m - 1, d - 1));
}

export async function loadDaily(): Promise<DailyState | undefined> {
  return kvGet<DailyState>('daily');
}

export function saveDaily(d: DailyState): Promise<void> {
  return kvSet('daily', d);
}

/** La racha sigue viva si el último día resuelto es hoy o ayer. */
export function liveStreak(d: DailyState | undefined, now = today()): number {
  if (!d || !d.lastSolvedDay) return 0;
  return d.lastSolvedDay === now || d.lastSolvedDay === dayBefore(now) ? d.streak : 0;
}

// ---------- lecciones ----------

export type LessonProgress = Record<string, { best: number; done: boolean }>;

export async function loadLessons(): Promise<LessonProgress> {
  return (await kvGet<LessonProgress>('lessons')) ?? {};
}

export function saveLessons(p: LessonProgress): Promise<void> {
  return kvSet('lessons', p);
}

// ---------- finales ----------

export interface FinalsStats {
  played: number;
  won: number;
}

export async function loadFinals(): Promise<FinalsStats> {
  return (await kvGet<FinalsStats>('finals')) ?? { played: 0, won: 0 };
}

export function saveFinals(f: FinalsStats): Promise<void> {
  return kvSet('finals', f);
}
