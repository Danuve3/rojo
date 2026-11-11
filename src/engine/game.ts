import { FIRST_TOKEN, TOTAL_TILES } from './constants';
import { applyTurn, isLegal } from './moves';
import { endRound, isRoundOver, startRound } from './round';
import { createEmptyState, sum } from './state';
import type { GameState, Move, RoundSummary, TurnResult } from './types';
import { completeRows, tileCount } from './wall';

export function newGame(numPlayers: number, seed: number, starter = 0): GameState {
  const s = createEmptyState(numPlayers, seed, starter);
  startRound(s);
  return s;
}

export interface StepResult {
  turn: TurnResult;
  round: RoundSummary | null;
}

/** Turno completo: aplica la jugada y, si la ronda se acaba, alicata. Muta el estado. */
export function step(s: GameState, m: Move, validate = true): StepResult {
  if (validate && !isLegal(s, m)) throw new Error(`Jugada ilegal: ${JSON.stringify(m)}`);
  const turn = applyTurn(s, m);
  const round = isRoundOver(s) ? endRound(s) : null;
  return { turn, round };
}

/** Recuento de losetas (para comprobar la conservación). */
export function countTiles(s: GameState): number {
  let total = sum(s.bag) + sum(s.box) + sum(s.center);
  for (const f of s.factories) total += sum(f);
  for (const p of s.players) {
    total += sum(p.lineCount) + tileCount(p.wall);
    for (const t of p.floor) if (t !== FIRST_TOKEN) total++;
  }
  return total;
}

export function isConserved(s: GameState): boolean {
  return countTiles(s) === TOTAL_TILES;
}

/** Ganadores: más puntos; desempate por filas completas; si persiste, victoria compartida. */
export function winners(s: GameState): number[] {
  const best = Math.max(...s.players.map((p) => p.score));
  const top = s.players.map((p, i) => ({ p, i })).filter(({ p }) => p.score === best);
  const bestRows = Math.max(...top.map(({ p }) => completeRows(p.wall)));
  return top.filter(({ p }) => completeRows(p.wall) === bestRows).map(({ i }) => i);
}
