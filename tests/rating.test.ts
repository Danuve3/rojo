import { describe, expect, it } from 'vitest';
import { accuracyScore, estimateLevel, ratePlayer } from '../src/coach/rating';
import type { HistoryEntry } from '../src/storage/history';

function game(level: number, beaten: boolean, accuracy: number | null = null, tags = {}): HistoryEntry {
  return {
    date: Date.now(), players: 2, myScore: beaten ? 60 : 30, won: beaten, coach: accuracy !== null, accuracy,
    analyzed: accuracy === null ? 0 : 30, labels: { imprecision: 3, error: 2, pifia: 1 }, tags, rounds: 5,
    opponents: [{ name: 'Bot', level, score: beaten ? 30 : 60, beaten }],
  };
}

describe('evaluación del jugador', () => {
  it('sin partidas no hay evaluación', () => {
    expect(ratePlayer([])).toBeNull();
  });
  it('ganar a niveles altos sube el nivel estimado', () => {
    const weak = estimateLevel(Array.from({ length: 10 }, () => game(3, false)));
    const strong = estimateLevel(Array.from({ length: 10 }, () => game(8, true)));
    expect(weak).toBeLessThan(3);
    expect(strong).toBeGreaterThan(8);
  });
  it('la precisión se puntúa de forma monótona', () => {
    expect(accuracyScore(46)).toBeLessThan(accuracyScore(65));
    expect(accuracyScore(65)).toBeLessThan(accuracyScore(95));
  });
  it('con pocas partidas la nota es provisional y más baja', () => {
    const few = ratePlayer([game(6, true, 80), game(6, true, 80)])!;
    const many = ratePlayer(Array.from({ length: 8 }, () => game(6, true, 80)))!;
    expect(few.provisional).toBe(true);
    expect(many.provisional).toBe(false);
    expect(few.grade).toBeLessThan(many.grade);
  });
  it('es dura: perder siempre contra nivel 4 con poca precisión saca suspenso', () => {
    const r = ratePlayer(Array.from({ length: 10 }, () => game(4, false, 45, { suelo_evitable: 3 })))!;
    expect(r.grade).toBeLessThan(30);
    expect(r.paragraphs.join(' ')).toContain('suelo evitable');
  });
});
