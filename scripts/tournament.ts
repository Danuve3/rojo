/**
 * Torneo bot contra bot.
 *   npm run tournament -- --levels 1,3,5,7,9 --games 40 --scale 0.25
 * Enfrenta cada par de niveles en partidas a 2 jugadores (alternando quién empieza)
 * y saca una tabla de % de victorias y puntuación media.
 */
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

interface Args {
  levels: number[];
  games: number;
  scale: number;
  players: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string, d: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : d;
  };
  return {
    levels: get('levels', '1,2,3,4,5,6,7,8,9,10').split(',').map(Number),
    games: Number(get('games', '30')),
    scale: Number(get('scale', '0.25')),
    players: Number(get('players', '2')),
  };
}

interface Job {
  a: number;
  b: number;
  seed: number;
}

interface Done extends Job {
  scores: number[];
  winners: number[];
  levels: number[];
}

async function main(): Promise<void> {
  const args = parseArgs();
  const jobs: Job[] = [];
  for (let i = 0; i < args.levels.length; i++) {
    for (let j = i + 1; j < args.levels.length; j++) {
      for (let g = 0; g < args.games; g++) jobs.push({ a: args.levels[i], b: args.levels[j], seed: 1000 + g * 31 + i * 7 + j });
    }
  }
  const threads = Math.max(1, Math.min(availableParallelism() - 0, 8));
  const workerFile = fileURLToPath(new URL('./tournamentWorker.ts', import.meta.url));
  const results: Done[] = [];
  const t0 = Date.now();
  let next = 0;
  await Promise.all(Array.from({ length: threads }, () => new Promise<void>((resolve, reject) => {
    const w = new Worker(workerFile, { execArgv: ['--import', 'tsx'], workerData: { scale: args.scale, players: args.players } });
    const feed = () => {
      if (next >= jobs.length) {
        void w.terminate().then(() => resolve());
        return;
      }
      w.postMessage(jobs[next++]);
    };
    w.on('message', (r: Done) => {
      results.push(r);
      if (results.length % 20 === 0) process.stderr.write(`\r${results.length}/${jobs.length}`);
      feed();
    });
    w.on('error', reject);
    feed();
  })));
  process.stderr.write('\n');
  report(args, results, (Date.now() - t0) / 1000);
}

function report(args: Args, results: Done[], secs: number): void {
  const L = args.levels;
  const key = (a: number, b: number) => `${a}-${b}`;
  const wins = new Map<string, number>();
  const games = new Map<string, number>();
  const score = new Map<number, { total: number; n: number }>();
  for (const r of results) {
    r.levels.forEach((lvl, seat) => {
      const sc = score.get(lvl) ?? { total: 0, n: 0 };
      sc.total += r.scores[seat];
      sc.n++;
      score.set(lvl, sc);
      for (let o = 0; o < r.levels.length; o++) {
        if (o === seat) continue;
        const k = key(lvl, r.levels[o]);
        games.set(k, (games.get(k) ?? 0) + 1);
        const share = r.winners.includes(seat) ? 1 / r.winners.length : 0;
        wins.set(k, (wins.get(k) ?? 0) + share);
      }
    });
  }
  const pad = (s: string, n = 6) => s.padStart(n);
  console.log(`\nTorneo: ${results.length} partidas, ${args.players} jugadores, escala MCTS ${args.scale}, ${secs.toFixed(0)} s\n`);
  console.log('% de victorias de la fila contra la columna');
  console.log(pad('nivel') + L.map((l) => pad(String(l))).join('') + pad('total', 8) + pad('media', 8));
  for (const a of L) {
    let w = 0;
    let n = 0;
    const cells = L.map((b) => {
      if (a === b) return pad('—');
      const g = games.get(key(a, b)) ?? 0;
      const x = wins.get(key(a, b)) ?? 0;
      w += x;
      n += g;
      return pad(g ? `${Math.round((100 * x) / g)}` : '·');
    });
    const sc = score.get(a);
    console.log(pad(String(a)) + cells.join('') + pad(n ? `${Math.round((100 * w) / n)}%` : '·', 8) + pad(sc ? (sc.total / sc.n).toFixed(1) : '·', 8));
  }
}

void main();
