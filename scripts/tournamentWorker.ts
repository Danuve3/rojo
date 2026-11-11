import { parentPort, workerData } from 'node:worker_threads';
import { playMatch } from './match';

const { scale, players } = workerData as { scale: number; players: number };

parentPort?.on('message', (job: { a: number; b: number; seed: number }) => {
  const seatsA = job.seed % 2 === 0;
  const base = seatsA ? [job.a, job.b] : [job.b, job.a];
  const levels = players === 2 ? base : Array.from({ length: players }, (_, i) => base[i % 2]);
  const r = playMatch(levels, job.seed, scale);
  parentPort?.postMessage({ ...job, ...r });
});
