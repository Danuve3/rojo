import { cloneState, type GameState } from '../../engine';

/** Gira una posición para que el jugador `mover` pase a ser el jugador 0 (tú) y le toque. */
export function rotateToMe(s: GameState, mover: number): GameState {
  const n = s.numPlayers;
  const map = (i: number) => (i < 0 ? i : (i - mover + n) % n);
  const c = cloneState(s);
  const players = c.players.slice();
  c.players = players.map((_, i) => players[(i + mover) % n]);
  c.current = map(s.current);
  c.roundStarter = map(s.roundStarter);
  c.firstTaker = map(s.firstTaker);
  return c;
}
