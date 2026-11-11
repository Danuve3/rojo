import { describe, expect, it } from 'vitest';
import { bit, placementScore, wallColor, wallCol } from '../src/engine';
import { wallOf } from './helpers';

describe('patrón del muro', () => {
  it('cada fila y columna contiene cada color una vez', () => {
    for (let r = 0; r < 5; r++) {
      expect(new Set([0, 1, 2, 3, 4].map((c) => wallColor(r, c))).size).toBe(5);
      expect(new Set([0, 1, 2, 3, 4].map((c) => wallColor(c, r))).size).toBe(5);
    }
  });
  it('wallCol es la inversa de wallColor', () => {
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) expect(wallCol(r, wallColor(r, c))).toBe(c);
  });
});

describe('puntuación por adyacencia', () => {
  it('loseta aislada vale 1', () => {
    const w = wallOf([[2, 2], [0, 0]]);
    expect(placementScore(w, 2, 2).points).toBe(1);
  });
  it('solo horizontal cuenta el tramo', () => {
    const w = wallOf([[1, 0], [1, 1], [1, 2]]);
    expect(placementScore(w, 1, 2).points).toBe(3);
    expect(placementScore(w, 1, 1).points).toBe(3);
  });
  it('solo vertical cuenta el tramo', () => {
    const w = wallOf([[0, 4], [1, 4]]);
    expect(placementScore(w, 1, 4).points).toBe(2);
  });
  it('cruz: horizontal + vertical, la nueva cuenta en ambos', () => {
    const w = wallOf([[2, 2], [2, 1], [2, 3], [1, 2], [3, 2]]);
    expect(placementScore(w, 2, 2).points).toBe(6);
  });
  it('un hueco corta el tramo', () => {
    const w = wallOf([[0, 0], [0, 2], [0, 3]]);
    expect(placementScore(w, 0, 2).points).toBe(2);
    expect(placementScore(w | bit(0, 1), 0, 1).points).toBe(4);
  });
  it('devuelve las celdas que puntúan', () => {
    const w = wallOf([[2, 2], [2, 1], [1, 2]]);
    const r = placementScore(w, 2, 2);
    expect(new Set(r.cells)).toEqual(new Set([12, 11, 7]));
  });
});
