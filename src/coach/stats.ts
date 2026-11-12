import {
  completeColors, completeCols, completeRows, type GameState, type Move, newGame, step, sum,
} from '../engine';
import type { MoveRecord } from './types';

/** Estadísticas exactas de un jugador en una partida (obtenidas repitiéndola). */
export interface GameStats {
  rounds: number;
  /** Puntos perdidos por el suelo. */
  floorLost: number;
  /** Losetas mandadas al suelo (incluidas las que acabaron en la caja). */
  tilesToFloor: number;
  /** Puntos de colocación (adyacencia) y número de losetas colocadas. */
  placementPoints: number;
  tilesPlaced: number;
  bonusPoints: number;
  rowsDone: number;
  colsDone: number;
  colorsDone: number;
  /** Rondas en las que se llevó la ficha inicial. */
  firstTokens: number;
  /** Losetas atascadas en líneas incompletas al acabar. */
  stuckTiles: number;
  /** ¿Cerró él la fila que terminó la partida? ¿Iba por delante entonces? */
  endedGame: boolean;
  aheadAtEnd: boolean;
  /** Pérdida media del entrenador en la última ronda y en el resto. */
  lossLastRound: number | null;
  lossEarlier: number | null;
}

/** Repite la partida desde la semilla y las jugadas registradas. */
export function replayStats(
  numPlayers: number,
  seed: number,
  starter: number,
  moves: Array<{ player: number; move: Move }>,
  me: number,
  records: MoveRecord[] = [],
): { stats: GameStats; final: GameState } {
  const s = newGame(numPlayers, seed, starter);
  const st: GameStats = {
    rounds: 1, floorLost: 0, tilesToFloor: 0, placementPoints: 0, tilesPlaced: 0, bonusPoints: 0,
    rowsDone: 0, colsDone: 0, colorsDone: 0, firstTokens: 0, stuckTiles: 0, endedGame: false, aheadAtEnd: false,
    lossLastRound: null, lossEarlier: null,
  };
  for (const { move } of moves) {
    if (s.phase !== 'playing') break;
    const before = s.players.map((p) => completeRows(p.wall));
    const { turn, round } = step(s, move, false);
    if (turn.player === me) {
      st.tilesToFloor += turn.toFloor + turn.toBox;
      if (turn.tookFirst) st.firstTokens++;
    }
    if (!round) continue;
    for (const pl of round.placements) if (pl.player === me) {
      st.placementPoints += pl.points;
      st.tilesPlaced++;
    }
    st.floorLost += round.penalties.find((p) => p.player === me)?.penalty ?? 0;
    if (round.gameOver) {
      const b = round.bonuses.find((x) => x.player === me);
      st.bonusPoints = b?.points ?? 0;
      const preBonus = s.players.map((p, i) => p.score - (round.bonuses.find((x) => x.player === i)?.points ?? 0));
      st.endedGame = completeRows(s.players[me].wall) > before[me] && before.every((n) => n === 0);
      st.aheadAtEnd = preBonus[me] >= Math.max(...preBonus.filter((_, i) => i !== me));
    } else st.rounds++;
  }
  const p = s.players[me];
  st.rowsDone = completeRows(p.wall);
  st.colsDone = completeCols(p.wall);
  st.colorsDone = completeColors(p.wall);
  st.stuckTiles = sum(p.lineCount);
  const last = records.filter((r) => r.round === st.rounds);
  const earlier = records.filter((r) => r.round !== st.rounds);
  const mean = (xs: MoveRecord[]) => (xs.length ? xs.reduce((a, r) => a + r.loss, 0) / xs.length : null);
  st.lossLastRound = mean(last);
  st.lossEarlier = mean(earlier);
  return { stats: st, final: s };
}
