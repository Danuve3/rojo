/**
 * Calibra los umbrales del entrenador: valora con el análisis del entrenador las jugadas
 * de bots de distintos niveles y muestra la pérdida media y el reparto de etiquetas.
 *   npm run calibrate:coach -- --levels 2,4,6,8,10 --games 2 --budget 300
 */
import { chooseBotMove } from '../src/ai/bot';
import { levelParams } from '../src/ai/levels';
import { CoachEngine } from '../src/coach/engine';
import type { VerdictLabel } from '../src/coach/types';
import { moveAccuracy } from '../src/coach/verdict';
import { cloneState, createRng, newGame, step } from '../src/engine';

const argv = process.argv.slice(2);
const arg = (k: string, d: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const LEVELS = arg('levels', '2,4,6,8,10').split(',').map(Number);
const GAMES = Number(arg('games', '2'));
const BUDGET = Number(arg('budget', '300'));
const LABELS: VerdictLabel[] = ['excelente', 'buena', 'imprecision', 'error', 'pifia'];

async function main(): Promise<void> {
  console.log(`nivel  jugadas  pérdida media  precisión  ${LABELS.join(' / ')}`);
  for (const level of LEVELS) {
    const coach = new CoachEngine();
    const losses: number[] = [];
    const counts: Record<string, number> = {};
    for (let g = 0; g < GAMES; g++) {
      const s = newGame(2, 900 + g, g % 2);
      const rnd = createRng(31 + g);
      while (s.phase === 'playing') {
        const lvl = s.current === 0 ? level : 7;
        const lp = levelParams(lvl);
        const m = chooseBotMove(s, lvl, rnd, lp.mode === 'mcts' ? { iterations: Math.round(lp.budgetMs * 20), budgetMs: 1e9 } : {});
        if (s.current === 0) {
          const v = await coach.rate(cloneState(s), m, ['A', 'B'], BUDGET);
          if (v) {
            losses.push(v.loss);
            counts[v.label] = (counts[v.label] ?? 0) + 1;
          }
        }
        step(s, m);
      }
    }
    const mean = losses.reduce((a, b) => a + b, 0) / losses.length;
    const acc = losses.reduce((a, b) => a + moveAccuracy(b), 0) / losses.length;
    const dist = LABELS.map((l) => `${Math.round((100 * (counts[l] ?? 0)) / losses.length)}%`).join(' / ');
    console.log(`${String(level).padStart(5)}  ${String(losses.length).padStart(7)}  ${mean.toFixed(2).padStart(13)}  ${acc.toFixed(0).padStart(8)}%  ${dist}`);
  }
}

void main();
