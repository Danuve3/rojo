import { newGame, createRng, legalMoves, step } from '../src/engine';
import { Mcts } from '../src/ai/mcts';
import { chooseBotMove } from '../src/ai/bot';

const s = newGame(2, 123);
const rnd = createRng(1);
for (const ms of [200, 600]) {
  const t = new Mcts(s, { rnd });
  const t0 = performance.now();
  t.run(ms);
  console.log(`mcts ${ms}ms -> ${t.iterations} iteraciones (${(performance.now() - t0).toFixed(0)}ms)`);
  console.log(t.results().slice(0, 4).map((m) => `${JSON.stringify(m.move)} v=${m.value.toFixed(2)} n=${m.visits}`).join('\n'));
}
for (const lvl of [3, 6]) {
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) chooseBotMove(s, lvl, rnd);
  console.log(`nivel ${lvl}: ${((performance.now() - t0) / 20).toFixed(1)} ms/jugada`);
}
void legalMoves; void step;
