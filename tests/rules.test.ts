import { describe, expect, it } from 'vitest';
import {
  applyBonuses, applyFloor, applyTurn, bit, countTiles, drawTile, endRound, FIRST_TOKEN, isGameEndTriggered,
  legalMoves, newGame, startRound, winners, wallCol, wallColor, type GameState,
} from '../src/engine';
import { emptyGame, wallOf } from './helpers';

function withCenter(s: GameState, center: number[]): GameState {
  s.center = center.slice();
  return s;
}

describe('suelo', () => {
  it('aplica penalizaciones -1,-1,-2,-2,-2,-3,-3', () => {
    const expected = [0, 1, 2, 4, 6, 8, 11, 14];
    for (let k = 0; k <= 7; k++) {
      const s = emptyGame();
      s.players[0].score = 50;
      s.players[0].floor = new Array<number>(k).fill(1);
      expect(applyFloor(s, 0).penalty).toBe(expected[k]);
      expect(s.players[0].score).toBe(50 - expected[k]);
      expect(s.players[0].floor).toEqual([]);
      expect(s.box[1]).toBe(k);
    }
  });
  it('el marcador nunca baja de 0', () => {
    const s = emptyGame();
    s.players[0].score = 3;
    s.players[0].floor = [0, 0, 0, 0];
    applyFloor(s, 0);
    expect(s.players[0].score).toBe(0);
  });
  it('el exceso con el suelo lleno va a la caja sin penalización', () => {
    const s = emptyGame();
    s.bag = [0, 0, 0, 0, 0];
    s.factories[0] = [4, 0, 0, 0, 0];
    s.players[0].floor = [1, 1, 1, 1, 1];
    const r = applyTurn(s, { source: 0, color: 0, target: 'floor' });
    expect(r.toFloor).toBe(2);
    expect(r.toBox).toBe(2);
    expect(s.players[0].floor.length).toBe(7);
    expect(s.box[0]).toBe(2);
  });
  it('las losetas que no caben en la línea van al suelo', () => {
    const s = emptyGame();
    s.factories[0] = [3, 1, 0, 0, 0];
    const r = applyTurn(s, { source: 0, color: 0, target: 1 });
    expect(r.toLine).toBe(2);
    expect(r.toFloor).toBe(1);
    expect(s.center[1]).toBe(1);
  });
});

describe('ficha inicial', () => {
  it('el primero que coge del centro se la lleva a su suelo', () => {
    const s = withCenter(emptyGame(), [0, 2, 0, 0, 0]);
    s.current = 1;
    const r = applyTurn(s, { source: 'center', color: 1, target: 1 });
    expect(r.tookFirst).toBe(true);
    expect(s.players[1].floor).toEqual([FIRST_TOKEN]);
    expect(s.firstTaker).toBe(1);
    s.center[2] = 1;
    const r2 = applyTurn(s, { source: 'center', color: 2, target: 0 });
    expect(r2.tookFirst).toBe(false);
  });
  it('quien la tiene empieza la ronda siguiente y vuelve al centro', () => {
    const s = newGame(3, 42);
    s.factories.forEach((f) => f.fill(0));
    s.center = [0, 0, 1, 0, 0];
    s.bag = [20, 20, 20, 20, 20];
    s.box = [0, 0, 0, 0, 0];
    s.current = 2;
    applyTurn(s, { source: 'center', color: 2, target: 0 });
    const sum = endRound(s);
    expect(sum.gameOver).toBe(false);
    expect(s.current).toBe(2);
    expect(s.centerHasFirst).toBe(true);
    expect(s.players[2].floor).toEqual([]);
  });
});

describe('líneas de patrón', () => {
  it('no se puede poner un color que ya está en la fila del muro ni mezclar colores', () => {
    const s = emptyGame();
    s.factories[0] = [2, 2, 0, 0, 0];
    s.players[0].wall = bit(1, wallCol(1, 0));
    s.players[0].lineColor[2] = 1;
    s.players[0].lineCount[2] = 1;
    const targets = legalMoves(s).filter((m) => m.source === 0 && m.color === 0).map((m) => m.target);
    expect(targets).toEqual([0, 3, 4, 'floor']);
  });
  it('alicatado: la línea completa pasa al muro y el resto a la caja', () => {
    const s = emptyGame();
    s.players[0].lineColor = [-1, -1, 3, 2, -1];
    s.players[0].lineCount = [0, 0, 3, 2, 0];
    const box = s.box.slice();
    const r = endRound(s);
    expect(r.placements).toHaveLength(1);
    expect(s.players[0].wall).toBe(bit(2, wallCol(2, 3)));
    expect(s.box[3]).toBe(box[3] + 2);
    expect(s.players[0].lineCount[3]).toBe(2);
  });
  it('deduplica expositores con idéntico contenido', () => {
    const s = emptyGame();
    s.factories[0] = [2, 2, 0, 0, 0];
    s.factories[1] = [2, 2, 0, 0, 0];
    s.factories[2] = [1, 3, 0, 0, 0];
    const sources = new Set(legalMoves(s).map((m) => m.source));
    expect(sources).toEqual(new Set([0, 2]));
  });
});

describe('bolsa', () => {
  it('se rellena desde la caja cuando se vacía', () => {
    const s = emptyGame();
    s.bag = [0, 1, 0, 0, 0];
    s.box = [3, 0, 0, 0, 2];
    expect(drawTile(s)).toBe(1);
    const c = drawTile(s);
    expect([0, 4]).toContain(c);
    expect(s.bag[0] + s.bag[4]).toBe(4);
    expect(s.box).toEqual([0, 0, 0, 0, 0]);
  });
  it('si bolsa y caja están vacías, los expositores quedan incompletos', () => {
    const s = emptyGame();
    s.bag = [3, 2, 0, 0, 0];
    s.box = [0, 0, 0, 0, 1];
    startRound(s);
    const placed = s.factories.reduce((t, f) => t + f.reduce((a, b) => a + b, 0), 0);
    expect(placed).toBe(6);
  });
  it('la preparación inicial reparte 4 losetas por expositor', () => {
    for (const n of [2, 3, 4]) {
      const s = newGame(n, n);
      expect(s.factories).toHaveLength(n * 2 + 1);
      for (const f of s.factories) expect(f.reduce((a, b) => a + b, 0)).toBe(4);
      expect(countTiles(s)).toBe(100);
    }
  });
});

describe('fin de partida', () => {
  it('termina al acabar la ronda en la que alguien completa una fila', () => {
    const s = emptyGame();
    s.players[1].wall = wallOf([[0, 0], [0, 1], [0, 2], [0, 3]]);
    s.players[1].lineColor[0] = wallColor(0, 4);
    s.players[1].lineCount[0] = 1;
    expect(isGameEndTriggered(s)).toBe(false);
    const r = endRound(s);
    expect(r.gameOver).toBe(true);
    expect(s.phase).toBe('over');
    // 5 de la fila + bonus de fila
    expect(s.players[1].score).toBe(5 + 2);
  });
  it('bonus: +2 fila, +7 columna, +10 color', () => {
    const s = emptyGame();
    let w = 0;
    for (let c = 0; c < 5; c++) w |= bit(0, c);
    for (let r = 0; r < 5; r++) w |= bit(r, 0);
    for (let r = 0; r < 5; r++) w |= bit(r, wallCol(r, 3));
    s.players[0].wall = w;
    const [b] = applyBonuses(s);
    expect(b.rows).toBe(1);
    expect(b.cols).toBe(1);
    expect(b.colors).toBe(1);
    expect(b.points).toBe(2 + 7 + 10);
  });
});

describe('desempate', () => {
  it('gana quien más puntos tiene', () => {
    const s = emptyGame(3);
    s.players[0].score = 10;
    s.players[1].score = 12;
    expect(winners(s)).toEqual([1]);
  });
  it('a igualdad de puntos gana quien tiene más filas completas', () => {
    const s = emptyGame(2);
    s.players[0].score = 20;
    s.players[1].score = 20;
    s.players[1].wall = 0b11111;
    expect(winners(s)).toEqual([1]);
  });
  it('si persiste el empate, la victoria es compartida', () => {
    const s = emptyGame(3);
    s.players.forEach((p) => (p.score = 15));
    s.players[2].score = 3;
    expect(winners(s)).toEqual([0, 1]);
  });
});

describe('aviso de fin de partida', () => {
  it('detecta la línea que completará una fila al alicatar', async () => {
    const { pendingRowCompletions } = await import('../src/engine');
    const s = emptyGame();
    const p = s.players[0];
    p.wall = wallOf([[2, 0], [2, 1], [2, 2], [2, 3]]);
    expect(pendingRowCompletions(p)).toEqual([]);
    p.lineColor[2] = wallColor(2, 4);
    p.lineCount[2] = 2;
    expect(pendingRowCompletions(p)).toEqual([]);
    p.lineCount[2] = 3;
    expect(pendingRowCompletions(p)).toEqual([2]);
  });
});
