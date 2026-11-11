/// <reference lib="webworker" />
import { chooseBotMove } from '../ai/bot';
import { createRng } from '../engine';
import type { WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const cancelled = new Set<number>();

function reply(r: WorkerResponse): void {
  self.postMessage(r);
}

async function handle(req: WorkerRequest): Promise<void> {
  if (req.type === 'cancel') {
    cancelled.add(req.id);
    return;
  }
  try {
    if (req.type === 'bot') {
      const move = chooseBotMove(req.state, req.level, createRng(req.seed));
      reply({ id: req.id, ok: true, result: move });
    } else {
      // El análisis del entrenador llega en la fase 6.
      reply({ id: req.id, ok: true, result: null });
    }
  } catch (e) {
    reply({ id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  } finally {
    cancelled.delete(req.id);
  }
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => void handle(ev.data);
