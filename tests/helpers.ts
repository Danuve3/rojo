import { bit, createEmptyState, createRng, type GameState, legalMoves, newGame, step, type Move } from '../src/engine';

export function wallOf(cells: Array<[number, number]>): number {
  return cells.reduce((w, [r, c]) => w | bit(r, c), 0);
}

export function emptyGame(players = 2): GameState {
  return createEmptyState(players, 1);
}

/** Juega una partida completa con una política dada. Devuelve el estado final. */
export function playOut(
  seed: number,
  players: number,
  choose: (s: GameState, moves: Move[], rnd: () => number) => Move,
  onStep?: (s: GameState) => void,
): GameState {
  const s = newGame(players, seed);
  const rnd = createRng(seed ^ 0x5bd1e995);
  let guard = 0;
  while (s.phase === 'playing') {
    const moves = legalMoves(s);
    if (moves.length === 0) throw new Error('Sin jugadas legales en una partida en curso');
    step(s, choose(s, moves, rnd));
    onStep?.(s);
    if (++guard > 5000) throw new Error('Partida infinita');
  }
  return s;
}

export const randomPolicy = (_s: GameState, moves: Move[], rnd: () => number): Move =>
  moves[Math.floor(rnd() * moves.length)];
