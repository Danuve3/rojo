import { describe, expect, it } from 'vitest';
import { chooseBotMove } from '../src/ai/bot';
import { improvementsFor } from '../src/coach/improvements';
import { replayStats, type GameStats } from '../src/coach/stats';
import { createRng, type Move, newGame, step } from '../src/engine';
import type { HistoryEntry } from '../src/storage/history';

describe('estadísticas por repetición', () => {
  it('reproduce exactamente la partida a partir de la semilla y las jugadas', () => {
    for (const seed of [11, 12, 13]) {
      const s = newGame(3, seed, 1);
      const rnd = createRng(seed);
      const moves: Array<{ player: number; move: Move }> = [];
      let floor = 0;
      while (s.phase === 'playing') {
        const player = s.current;
        const move = chooseBotMove(s, 3, rnd);
        moves.push({ player, move });
        const r = step(s, move);
        floor += r.round?.penalties.find((p) => p.player === 0)?.penalty ?? 0;
      }
      const { stats, final } = replayStats(3, seed, 1, moves, 0);
      expect(final.players.map((p) => p.score)).toEqual(s.players.map((p) => p.score));
      expect(final.players[0].wall).toBe(s.players[0].wall);
      expect(stats.floorLost).toBe(floor);
      expect(stats.tilesPlaced).toBeGreaterThan(0);
    }
  });
});

const base: GameStats = {
  rounds: 5, floorLost: 4, tilesToFloor: 3, placementPoints: 55, tilesPlaced: 14, bonusPoints: 19, rowsDone: 1,
  colsDone: 1, colorsDone: 1, firstTokens: 1, stuckTiles: 1, endedGame: false, aheadAtEnd: true, lossLastRound: 0.5, lossEarlier: 0.5,
};

function entry(stats: Partial<GameStats>, extra: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date: 0, players: 2, myScore: 50, won: false, coach: true, accuracy: 60, analyzed: 30, labels: {}, tags: {}, rounds: 5,
    opponents: [{ name: 'B', level: 5, score: 50, beaten: false }], stats: { ...base, ...stats }, ...extra,
  };
}

describe('mejoras concretas', () => {
  it('un buen jugador no recibe reproches de estadísticas', () => {
    const items = improvementsFor(Array.from({ length: 5 }, () => entry({})));
    expect(items.map((i) => i.title)).not.toContain('Deja de alimentar el suelo');
  });
  it('detecta el suelo, los bonus y el muro suelto, con cifras, y ordena por coste', () => {
    const items = improvementsFor(Array.from({ length: 5 }, () => entry({ floorLost: 30, tilesToFloor: 14, bonusPoints: 2, colsDone: 0, colorsDone: 0, placementPoints: 30 })));
    const titles = items.map((i) => i.title);
    expect(titles[0]).toBe('Deja de alimentar el suelo');
    expect(titles).toContain('Juega a por los bonus');
    expect(titles).toContain('Coloca pegado a lo que ya tienes');
    expect(items[0].detail).toContain('30,0 puntos');
    for (let i = 1; i < items.length; i++) expect(items[i - 1].cost).toBeGreaterThanOrEqual(items[i].cost);
  });
  it('sugiere subir de nivel si ganas casi siempre', () => {
    const items = improvementsFor(Array.from({ length: 6 }, () => entry({}, { opponents: [{ name: 'B', level: 4, score: 30, beaten: true }] })));
    expect(items.some((i) => i.title === 'Sube la dificultad' && i.detail.includes('nivel 5'))).toBe(true);
  });
});
