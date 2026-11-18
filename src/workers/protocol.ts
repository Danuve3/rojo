import type { GameState, Move } from '../engine';
import type { Analysis, Verdict } from '../coach/types';
import type { Puzzle } from '../coach/training/generate';

export type WorkerRequest =
  | { type: 'bot'; id: number; state: GameState; level: number; seed: number }
  | { type: 'analyze'; id: number; state: GameState; budgetMs: number }
  | { type: 'rate'; id: number; state: GameState; move: Move; names: string[]; budgetMs: number }
  | { type: 'genPuzzles'; id: number; seed: number; count: number; minGap: number; timeMs: number; analyzeMs: number }
  | { type: 'genFinal'; id: number; seed: number; players: number }
  | { type: 'cancel'; id: number };

export type WorkerResult = Move | Analysis | Verdict | Puzzle[] | GameState | null;

export type WorkerResponse = { id: number; ok: true; result: WorkerResult } | { id: number; ok: false; error: string };
