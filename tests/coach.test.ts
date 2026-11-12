import { describe, expect, it } from 'vitest';
import { CoachEngine } from '../src/coach/engine';
import { explainLoss } from '../src/coach/explain';
import { labelFor, moveAccuracy } from '../src/coach/verdict';
import { legalMoves, newGame, type Move } from '../src/engine';

describe('etiquetas de valoración', () => {
  it('usa los umbrales del documento', () => {
    expect(labelFor(0)).toBe('excelente');
    expect(labelFor(0.3)).toBe('excelente');
    expect(labelFor(0.31)).toBe('buena');
    expect(labelFor(1)).toBe('buena');
    expect(labelFor(2.5)).toBe('imprecision');
    expect(labelFor(5)).toBe('error');
    expect(labelFor(5.1)).toBe('pifia');
  });
  it('la precisión baja con la pérdida', () => {
    expect(moveAccuracy(0)).toBe(100);
    expect(moveAccuracy(2)).toBeLessThan(moveAccuracy(1));
  });
});

describe('motor del entrenador', () => {
  it('analiza, ordena por valor y valora una jugada claramente mala', async () => {
    const s = newGame(2, 77);
    const coach = new CoachEngine();
    const a = await coach.analyze(s, 300);
    expect(a).not.toBeNull();
    expect(a!.moves.length).toBeGreaterThan(3);
    for (let i = 1; i < a!.moves.length; i++) expect(a!.moves[i - 1].value).toBeGreaterThanOrEqual(a!.moves[i].value);
    // Tirar 4 losetas al suelo en la primera jugada es una pifia o un error.
    const worst = legalMoves(s).filter((m) => m.target === 'floor')
      .sort((x, y) => s.factories[y.source as number]?.[y.color] - s.factories[x.source as number]?.[x.color])[0] as Move;
    const v = await coach.rate(s, worst, ['Tú', 'Bot'], 300);
    expect(v).not.toBeNull();
    expect(v!.loss).toBeGreaterThan(1);
    expect(['imprecision', 'error', 'pifia']).toContain(v!.label);
    expect(v!.reasons.length).toBeGreaterThan(0);
    expect(v!.tags).toContain('suelo_evitable');
    // La mejor jugada se valora como excelente.
    const best = await coach.rate(s, v!.best.move, ['Tú', 'Bot'], 300);
    expect(best!.label).toBe('excelente');
    expect(explainLoss(v!.mine, v!.best, ['Tú', 'Bot']).length).toBeGreaterThan(0);
  });
});

describe('frases de inicio', async () => {
  const { TAGLINES, nextTagline } = await import('../src/ui/taglines');
  it('hay 20 y nunca se repite la anterior', () => {
    expect(TAGLINES).toHaveLength(20);
    let prev = -1;
    for (let i = 0; i < 200; i++) {
      const n = nextTagline(prev);
      expect(n).not.toBe(prev);
      prev = n;
    }
  });
});
