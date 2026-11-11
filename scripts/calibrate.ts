/**
 * Calibración de pesos por búsqueda de coordenadas.
 *   npm run calibrate -- --games 80 --level 7
 * Para cada factor prueba a multiplicar su peso y enfrenta la variante contra la base.
 * Imprime los pesos que mejoran el % de victorias.
 */
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { FACTOR_NAMES, type FactorName } from '../src/ai/factors';
import { WEIGHTS } from '../src/ai/weights';

const argv = process.argv.slice(2);
const arg = (k: string, d: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const GAMES = Number(arg('games', '80'));
const LEVEL = Number(arg('level', '7'));
const MULTS = arg('mults', '0.5,1.6').split(',').map(Number);

type Weights = Record<FactorName, number>;

async function duel(variant: Weights, base: Weights): Promise<number> {
  const threads = Math.max(1, availableParallelism());
  const file = fileURLToPath(new URL('./calibrateWorker.ts', import.meta.url));
  const seeds = Array.from({ length: GAMES }, (_, i) => 5000 + i);
  let next = 0;
  let score = 0;
  await Promise.all(Array.from({ length: threads }, () => new Promise<void>((resolve, reject) => {
    const w = new Worker(file, { execArgv: ['--import', 'tsx'], workerData: { variant, base, level: LEVEL } });
    const feed = () => (next < seeds.length ? w.postMessage(seeds[next++]) : void w.terminate().then(() => resolve()));
    w.on('message', (r: number) => {
      score += r;
      feed();
    });
    w.on('error', reject);
    feed();
  })));
  return score / GAMES;
}

async function main(): Promise<void> {
  const best: Weights = { ...WEIGHTS };
  console.log(`Calibrando nivel ${LEVEL} con ${GAMES} partidas por variante`);
  for (const f of FACTOR_NAMES) {
    for (const m of MULTS) {
      const variant = { ...best, [f]: +(best[f] * m).toFixed(3) };
      const wr = await duel(variant, best);
      const mark = wr > 0.56 ? '  ← mejora' : '';
      console.log(`${f.padEnd(18)} ×${m}: ${(wr * 100).toFixed(1)}%${mark}`);
      if (wr > 0.56) {
        best[f] = variant[f];
        break;
      }
    }
  }
  console.log('\nPesos resultantes:');
  console.log(JSON.stringify(best, null, 2));
}

void main();
