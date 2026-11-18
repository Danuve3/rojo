import { describe, expect, it } from 'vitest';
import { challengeProgress, pickChallenge } from '../src/coach/challenges';
import type { GameStats } from '../src/coach/stats';
import { newGame } from '../src/engine';
import type { HistoryEntry } from '../src/storage/history';
import { DEFAULT_COACH } from '../src/ui/config';
import type { SavedGame } from '../src/ui/session';

const stats: GameStats = {
  rounds: 5, floorLost: 30, tilesToFloor: 14, placementPoints: 55, tilesPlaced: 14, bonusPoints: 19, rowsDone: 1,
  colsDone: 1, colorsDone: 1, firstTokens: 1, stuckTiles: 1, endedGame: false, aheadAtEnd: true, lossLastRound: 0.5, lossEarlier: 0.5,
};
const entry = (s: Partial<GameStats> = {}): HistoryEntry => ({
  date: 0, players: 2, myScore: 40, won: false, coach: true, accuracy: 60, analyzed: 20, labels: {}, tags: {}, rounds: 5,
  opponents: [{ name: 'B', level: 5, score: 50, beaten: false }], stats: { ...stats, ...s },
});

function game(): SavedGame {
  return {
    version: 1, id: 't', config: { players: [{ kind: 'human', name: 'Tú', level: 0 }, { kind: 'bot', name: 'B', level: 3 }], starter: 0, coach: DEFAULT_COACH, seed: 5 },
    state: newGame(2, 5, 0), undo: [], records: [], rounds: [], moves: [], startedAt: 0,
  };
}

describe('retos', () => {
  it('convierte la mejora principal en reto', () => {
    expect(pickChallenge(Array.from({ length: 4 }, () => entry()), true).id).toBe('floor');
    expect(pickChallenge(Array.from({ length: 4 }, () => entry({ floorLost: 2, bonusPoints: 0, colsDone: 0, colorsDone: 0 })), true).id).toBe('cols');
  });
  it('sin historial propone un reto de suelo', () => {
    expect(pickChallenge([], false).id).toBe('floor');
  });
  it('sigue el progreso en vivo', () => {
    const g = game();
    const p = challengeProgress({ id: 'floor', target: 8, title: 'x' }, g);
    expect(p.short).toBe('Suelo 0/8');
    g.state.players[0].floor = [1, 1, 1, 1, 1];
    expect(challengeProgress({ id: 'floor', target: 8, title: 'x' }, g).status).toBe('risk');
    g.state.players[0].floor = [1, 1, 1, 1, 1, 1];
    expect(challengeProgress({ id: 'floor', target: 8, title: 'x' }, g).status).toBe('fail');
    expect(challengeProgress({ id: 'cols', target: 1, title: 'x' }, g).short).toBe('Mejor columna 0/5');
  });
});
