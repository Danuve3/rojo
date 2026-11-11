import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/ai/evaluate';
import { FACTOR_NAMES } from '../src/ai/factors';
import { noisyArgmax } from '../src/ai/select';
import { bit, createRng, type GameState, legalMoves, wallCol } from '../src/engine';
import { emptyGame } from './helpers';

function table(s: GameState, factory: number[]): GameState {
  s.factories[0] = factory.slice();
  return s;
}

describe('evaluación por factores', () => {
  it('devuelve todos los factores y su suma es el total', () => {
    const s = table(emptyGame(), [2, 2, 0, 0, 0]);
    const e = evaluate(s, legalMoves(s)[0], { rivals: true });
    expect(Object.keys(e.factores).sort()).toEqual([...FACTOR_NAMES].sort());
    const sum = Object.values(e.factores).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(e.total, 6);
  });
  it('tirar al suelo penaliza', () => {
    const s = table(emptyGame(), [3, 1, 0, 0, 0]);
    const toFloor = evaluate(s, { source: 0, color: 0, target: 'floor' });
    const toLine = evaluate(s, { source: 0, color: 0, target: 2 });
    expect(toFloor.factores.penalizacionSuelo).toBeLessThan(-2);
    expect(toLine.factores.penalizacionSuelo).toBeCloseTo(0, 6);
    expect(toLine.total).toBeGreaterThan(toFloor.total);
  });
  it('completar una línea da puntos inmediatos', () => {
    const s = table(emptyGame(), [1, 3, 0, 0, 0]);
    const e = evaluate(s, { source: 0, color: 0, target: 0 });
    expect(e.factores.puntosInmediatos).toBeCloseTo(1, 6);
  });
  it('la ficha inicial cuesta el hueco del suelo', () => {
    const s = emptyGame();
    s.center = [0, 0, 2, 0, 0];
    const e = evaluate(s, { source: 'center', color: 2, target: 1 });
    expect(e.factores.fichaInicial).toBeLessThan(0.5);
  });
  it('detecta regalos al rival', () => {
    const s = emptyGame();
    s.factories[0] = [1, 1, 0, 0, 0];
    s.center = [0, 1, 0, 0, 0];
    s.centerHasFirst = false;
    const rival = s.players[1];
    rival.lineColor[3] = 1;
    rival.lineCount[3] = 2;
    rival.wall = [0, 1, 2, 4].reduce((w, r) => w | bit(r, wallCol(r, 0)), 0);
    // Coger el cobalto manda el ocre al centro: el rival junta 2 y cierra su línea.
    const gift = evaluate(s, { source: 0, color: 0, target: 0 }, { rivals: true });
    expect(gift.factores.regaloRival).toBeLessThan(0);
    expect(gift.rival?.player).toBe(1);
    expect(gift.rival?.color).toBe(1);
  });
});

describe('selección con ruido', () => {
  it('sin ruido elige siempre la mejor', () => {
    const rnd = createRng(1);
    for (let i = 0; i < 50; i++) expect(noisyArgmax([1, 5, 3], 0, 1, rnd)).toBe(1);
  });
  it('con ruido elige a veces una subóptima', () => {
    const rnd = createRng(2);
    const picks = Array.from({ length: 400 }, () => noisyArgmax([1, 5, 4.5], 0.5, 1, rnd));
    expect(picks.filter((p) => p !== 1).length).toBeGreaterThan(100);
  });
});
