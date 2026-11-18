import { describe, expect, it } from 'vitest';
import { adaptiveLevels, BOT_ELO, currentElo, eloHistory, levelForElo, START_ELO } from '../src/coach/elo';
import { bucketsOf } from '../src/coach/summary';
import { newGame } from '../src/engine';
import type { HistoryEntry } from '../src/storage/history';
import { DEFAULT_COACH } from '../src/ui/config';

const g = (level: number, beaten: boolean): HistoryEntry => ({
  date: 0, players: 2, myScore: 0, won: beaten, coach: false, accuracy: null, analyzed: 0, labels: {}, tags: {}, rounds: 5,
  opponents: [{ name: 'B', level, score: 0, beaten }],
});

describe('Elo', () => {
  it('los niveles de bot son monótonos', () => {
    for (let l = 2; l <= 10; l++) expect(BOT_ELO[l]).toBeGreaterThan(BOT_ELO[l - 1]);
  });
  it('sube al ganar y baja al perder, más contra rivales fuertes', () => {
    expect(currentElo([])).toBe(START_ELO);
    expect(currentElo([g(5, true)])).toBeGreaterThan(START_ELO);
    expect(currentElo([g(5, false)])).toBeLessThan(START_ELO);
    expect(eloHistory([g(9, true)])[0].delta).toBeGreaterThan(eloHistory([g(3, true)])[0].delta);
  });
  it('la dificultad automática empareja con el nivel más cercano', () => {
    expect(levelForElo(1080)).toBe(3);
    expect(levelForElo(1650)).toBe(8);
    expect(adaptiveLevels(1200, 3)).toEqual([4, 5, 6]);
  });
});

describe('precisión por fase', () => {
  it('reparte las jugadas por fase y decisión', () => {
    const s = newGame(2, 1);
    s.round = 4;
    const rec = (round: number, source: number | 'center', target: number | 'floor') => ({
      round, turn: 0, before: s, move: { source, color: 0 as const, target: target as never }, best: { source, color: 0 as const, target: target as never },
      loss: 0, label: 'excelente' as const, reasons: [], tags: [],
    });
    const b = bucketsOf({
      version: 1, id: 'x', config: { players: [], starter: 0, coach: DEFAULT_COACH, seed: 1 }, state: s, undo: [], rounds: [], moves: [], startedAt: 0,
      records: [rec(1, 0, 0), rec(3, 'center', 4), rec(4, 1, 'floor')],
    });
    expect(b.apertura.n).toBe(1);
    expect(b.medio.n).toBe(1);
    expect(b.final.n).toBe(1);
    expect(b.centro.n).toBe(1);
    expect(b.larga.n).toBe(1);
    expect(b.suelo.n).toBe(1);
    expect(b.corta.acc).toBe(100);
  });
});
