import type { GameState, Move } from '../engine';
import { randomSeed } from '../engine';
import type { WorkerRequest, WorkerResponse, WorkerResult } from '../workers/protocol';

type Pending = { resolve: (r: WorkerResult) => void; reject: (e: Error) => void };
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** Cliente de un Web Worker de IA con peticiones identificadas. */
export class WorkerClient {
  private w: Worker;
  private pending = new Map<number, Pending>();
  private seq = 0;

  constructor(factory: () => Worker) {
    this.w = factory();
    this.w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      if (ev.data.ok) p.resolve(ev.data.result);
      else p.reject(new Error(ev.data.error));
    };
  }

  call<T extends WorkerResult>(req: DistributiveOmit<Exclude<WorkerRequest, { type: 'cancel' }>, 'id'>): { id: number; promise: Promise<T> } {
    const id = ++this.seq;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: WorkerResult) => void, reject });
    });
    this.w.postMessage({ ...req, id } as WorkerRequest);
    return { id, promise };
  }

  cancel(id: number): void {
    this.w.postMessage({ type: 'cancel', id } satisfies WorkerRequest);
  }
}

export function createAiWorker(): Worker {
  return new Worker(new URL('../workers/ai.worker.ts', import.meta.url), { type: 'module', name: 'rojo-ia' });
}

export function botProvider(client: WorkerClient) {
  return {
    chooseMove(state: GameState, level: number): Promise<Move> {
      return client.call<Move>({ type: 'bot', state, level, seed: randomSeed() }).promise;
    },
  };
}
