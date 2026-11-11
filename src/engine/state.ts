import { factoriesFor, NUM_COLORS, TILES_PER_COLOR } from './constants';
import type { GameState, PlayerState } from './types';

export function createPlayer(): PlayerState {
  return { lineColor: [-1, -1, -1, -1, -1], lineCount: [0, 0, 0, 0, 0], wall: 0, floor: [], score: 0 };
}

export function createEmptyState(numPlayers: number, seed: number, starter = 0): GameState {
  if (numPlayers < 2 || numPlayers > 4) throw new Error('De 2 a 4 jugadores');
  return {
    numPlayers,
    players: Array.from({ length: numPlayers }, createPlayer),
    factories: Array.from({ length: factoriesFor(numPlayers) }, () => [0, 0, 0, 0, 0]),
    center: [0, 0, 0, 0, 0],
    centerHasFirst: true,
    bag: new Array<number>(NUM_COLORS).fill(TILES_PER_COLOR),
    box: [0, 0, 0, 0, 0],
    current: starter,
    round: 0,
    roundStarter: starter,
    firstTaker: -1,
    phase: 'playing',
    rng: seed | 0,
    turn: 0,
  };
}

function clonePlayer(p: PlayerState): PlayerState {
  return {
    lineColor: p.lineColor.slice(),
    lineCount: p.lineCount.slice(),
    wall: p.wall,
    floor: p.floor.slice(),
    score: p.score,
  };
}

/** Clon barato (sin JSON). */
export function cloneState(s: GameState): GameState {
  return {
    numPlayers: s.numPlayers,
    players: s.players.map(clonePlayer),
    factories: s.factories.map((f) => f.slice()),
    center: s.center.slice(),
    centerHasFirst: s.centerHasFirst,
    bag: s.bag.slice(),
    box: s.box.slice(),
    current: s.current,
    round: s.round,
    roundStarter: s.roundStarter,
    firstTaker: s.firstTaker,
    phase: s.phase,
    rng: s.rng,
    turn: s.turn,
  };
}

export function sum(a: readonly number[]): number {
  let t = 0;
  for (let i = 0; i < a.length; i++) t += a[i];
  return t;
}

/** Clave estable de una posición (sin el RNG, que es información oculta). */
export function stateKey(s: GameState): string {
  const { rng: _rng, ...rest } = s;
  void _rng;
  return JSON.stringify(rest);
}
