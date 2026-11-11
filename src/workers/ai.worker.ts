/// <reference lib="webworker" />
import { chooseBotMove } from '../ai/bot';
import { createRng } from '../engine';
import { CoachEngine } from '../coach/engine';
import type { WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const coach = new CoachEngine();
const cancelled = new Set<number>();

function reply(r: WorkerResponse): void {
  self.postMessage(r);
}

async function handle(req: WorkerRequest): Promise<void> {
  if (req.type === 'cancel') {
    cancelled.add(req.id);
    coach.cancel();
    return;
  }
  try {
    if (req.type === 'bot') {
      const move = chooseBotMove(req.state, req.level, createRng(req.seed));
      reply({ id: req.id, ok: true, result: move });
    } else if (req.type === 'analyze') {
      const a = await coach.analyze(req.state, req.budgetMs, () => cancelled.has(req.id));
      reply({ id: req.id, ok: true, result: a });
    } else if (req.type === 'rate') {
      const v = await coach.rate(req.state, req.move, req.names, req.budgetMs);
      reply({ id: req.id, ok: true, result: v });
    }
  } catch (e) {
    reply({ id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  } finally {
    cancelled.delete(req.id);
  }
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => void handle(ev.data);
