import { parentPort, workerData } from 'node:worker_threads';
import { chooseBotMove } from '../src/ai/bot';
import type { FactorName } from '../src/ai/factors';
import { WEIGHTS } from '../src/ai/weights';
import { createRng, newGame, step, winners } from '../src/engine';

type Weights = Record<FactorName, number>;
const { variant, base, level } = workerData as { variant: Weights; base: Weights; level: number };

/** Devuelve la fracción de victoria de la variante (con asientos alternos). */
function game(seed: number): number {
  const variantSeat = seed % 2;
  const s = newGame(2, seed, 0);
  const rnd = createRng(seed);
  while (s.phase === 'playing') {
    Object.assign(WEIGHTS, s.current === variantSeat ? variant : base);
    step(s, chooseBotMove(s, level, rnd, { iterations: 400, budgetMs: 1e9 }));
  }
  const w = winners(s);
  return w.includes(variantSeat) ? 1 / w.length : 0;
}

parentPort?.on('message', (seed: number) => parentPort?.postMessage(game(seed)));
