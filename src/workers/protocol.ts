import type { GameState, Move } from '../engine';
import type { Analysis, Verdict } from '../coach/types';

export type WorkerRequest =
  | { type: 'bot'; id: number; state: GameState; level: number; seed: number }
  | { type: 'analyze'; id: number; state: GameState; budgetMs: number }
  | { type: 'rate'; id: number; state: GameState; move: Move; names: string[]; budgetMs: number }
  | { type: 'cancel'; id: number };

export type WorkerResult = Move | Analysis | Verdict | null;

export type WorkerResponse = { id: number; ok: true; result: WorkerResult } | { id: number; ok: false; error: string };
