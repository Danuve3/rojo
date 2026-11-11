import type { WorkerClient } from '../ai/client';
import { type GameState, type Move, stateKey } from '../engine';
import type { CoachProvider } from '../ui/gameController';
import type { Analysis, Verdict } from './types';

export const ANALYZE_MS = 1500;

/** Entrenador en el hilo principal: pide análisis al worker y los cachea por estado. */
export class CoachClient implements CoachProvider {
  private cache = new Map<string, Promise<Analysis | null>>();
  private inflight: number | null = null;

  constructor(private worker: WorkerClient) {}

  analyze(s: GameState): Promise<Analysis | null> {
    const key = stateKey(s);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const { id, promise } = this.worker.call<Analysis | null>({ type: 'analyze', state: s, budgetMs: ANALYZE_MS });
    this.inflight = id;
    const p = promise.catch(() => null).finally(() => {
      if (this.inflight === id) this.inflight = null;
    });
    this.cache.set(key, p);
    if (this.cache.size > 12) this.cache.delete(this.cache.keys().next().value as string);
    return p;
  }

  rate(before: GameState, move: Move, names: string[]): Promise<Verdict | null> {
    return this.worker.call<Verdict | null>({ type: 'rate', state: before, move, names, budgetMs: ANALYZE_MS }).promise.catch(() => null);
  }

  cancel(): void {
    if (this.inflight !== null) {
      this.worker.cancel(this.inflight);
      // Un análisis cancelado no debe quedarse en caché a medias.
      for (const [k, p] of this.cache) void p.then((a) => (a && a.ms < ANALYZE_MS * 0.9 ? this.cache.delete(k) : undefined));
    }
  }
}
