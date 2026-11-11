import { describe, expect, it } from 'vitest';
import { countTiles, isLegal, legalMoves, step, newGame, createRng, TOTAL_TILES } from '../src/engine';
import { playOut, randomPolicy } from './helpers';

describe('propiedades del motor', () => {
  it('conserva 100 losetas y nunca genera jugadas ilegales (miles de partidas)', () => {
    let games = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const players = 2 + (seed % 3);
      playOut(seed, players, (s, moves, rnd) => {
        for (const m of moves) if (!isLegal(s, m)) throw new Error('ilegal');
        return randomPolicy(s, moves, rnd);
      }, (s) => {
        if (countTiles(s) !== TOTAL_TILES) throw new Error(`conservación rota: ${countTiles(s)}`);
        for (const p of s.players) if (p.score < 0 || p.floor.length > 7) throw new Error('estado inválido');
      });
      games++;
    }
    expect(games).toBe(3000);
  });

  it('es determinista con la misma semilla', () => {
    const run = (seed: number) => {
      const s = newGame(3, seed);
      const rnd = createRng(7);
      while (s.phase === 'playing') {
        const m = legalMoves(s);
        step(s, m[Math.floor(rnd() * m.length)]);
      }
      return s;
    };
    expect(JSON.stringify(run(99))).toBe(JSON.stringify(run(99)));
  });
});

describe('bots', () => {
  it('nunca generan jugadas ilegales y la partida conserva las losetas', async () => {
    const { chooseBotMove } = await import('../src/ai/bot');
    for (let seed = 1; seed <= 60; seed++) {
      const n = 2 + (seed % 3);
      const levels = Array.from({ length: n }, (_, i) => 1 + ((seed + i * 3) % 10));
      const s = newGame(n, seed);
      const rnd = createRng(seed);
      while (s.phase === 'playing') {
        const m = chooseBotMove(s, levels[s.current], rnd, { iterations: 60, budgetMs: 1e9 });
        expect(isLegal(s, m)).toBe(true);
        step(s, m);
        expect(countTiles(s)).toBe(TOTAL_TILES);
      }
    }
  });
});
