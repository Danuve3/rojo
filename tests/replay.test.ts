import { describe, expect, it } from 'vitest';
import { chooseBotMove } from '../src/ai/bot';
import { criticalMoments, errorBalance, replayPositions } from '../src/coach/replay';
import { createRng, type Move, newGame, step } from '../src/engine';

describe('análisis de partidas', () => {
  it('reconstruye todas las posiciones y detecta discrepancias', () => {
    const s = newGame(2, 77, 1);
    const rnd = createRng(3);
    const moves: Array<{ player: number; move: Move }> = [];
    while (s.phase === 'playing') {
      const m = chooseBotMove(s, 3, rnd);
      moves.push({ player: s.current, move: m });
      step(s, m);
    }
    const r = replayPositions(2, 77, 1, moves, s);
    expect(r).not.toBeNull();
    expect(r!.steps).toHaveLength(moves.length);
    expect(r!.steps.at(-1)!.state.players[0].score).toBe(s.players[0].score);
    expect(replayPositions(2, 78, 1, moves, s)).toBeNull();
  });
  it('el balance de errores baja con los tuyos y sube con los del rival', () => {
    const b = errorBalance([{ loss: 2, gap: 0 }, { loss: 1, gap: 0 }, null, { loss: 0.5, gap: 0 }], [0, 1, 0, 1], 0, 2);
    expect(b).toEqual([0, -2, -1, -1, -0.5]);
  });
  it('los momentos críticos son los errores más caros y las jugadas únicas', () => {
    const ev = [{ loss: 0, gap: 3 }, { loss: 4, gap: 0 }, { loss: 0.2, gap: 0.5 }, { loss: 1.5, gap: 0 }, { loss: 0, gap: 0.1 }, { loss: 0, gap: 2.5 }];
    const m = criticalMoments(ev, [0, 1, 0, 1, 0, 1], 0);
    expect(m.map((x) => x.kind)).toEqual(['tu_acierto', 'regalo_rival', 'golpe_rival']);
    expect(m.map((x) => x.index)).toEqual([1, 2, 6]);
  });
});
