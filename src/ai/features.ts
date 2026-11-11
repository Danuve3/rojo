import {
  bit, COL_BONUS, COLOR_BONUS, colCount, colorCount, FIRST_TOKEN, floorPenalty, type GameState, placementScore,
  type PlayerState, ROW_BONUS, rowCount, sum, wallCol,
} from '../engine';
import { PARAMS } from './weights';

/** Contexto común de una posición. */
export interface Context {
  avail: number[];
  roundsLeft: number;
  numPlayers: number;
}

export function tableAvailability(s: GameState): number[] {
  const a = s.center.slice();
  for (const f of s.factories) for (let c = 0; c < 5; c++) a[c] += f[c];
  return a;
}

/** Simula el alicatado de las líneas completas (sin mutar). */
export function pendingTiling(p: PlayerState): { wall: number; points: number; rowsDone: number } {
  let wall = p.wall;
  let points = 0;
  for (let r = 0; r < 5; r++) {
    if (p.lineCount[r] !== r + 1) continue;
    const col = wallCol(r, p.lineColor[r]);
    wall |= bit(r, col);
    points += placementScore(wall, r, col).points;
  }
  let rowsDone = 0;
  for (let r = 0; r < 5; r++) if (rowCount(wall, r) === 5) rowsDone++;
  return { wall, points, rowsDone };
}

/** Rondas que quedan tras la actual (estimación por la fila más avanzada de cualquiera). */
export function estimateRoundsLeft(s: GameState): number {
  let best = 0;
  for (const p of s.players) {
    const { wall } = pendingTiling(p);
    for (let r = 0; r < 5; r++) best = Math.max(best, rowCount(wall, r));
  }
  return Math.max(0, 5 - best);
}

export function contextOf(s: GameState): Context {
  return { avail: tableAvailability(s), roundsLeft: estimateRoundsLeft(s), numPlayers: s.numPlayers };
}

/** Probabilidad de completar una línea esta ronda o la siguiente. */
export function completionChance(need: number, color: number, ctx: Context): number {
  const avail = ctx.avail[color];
  const crowd = ctx.numPlayers <= 2 ? 1 : ctx.numPlayers === 3 ? 0.85 : 0.75;
  const pThis = avail >= need ? Math.min(0.9, (0.22 + 0.13 * (avail - need + 1)) * crowd) : 0;
  const pNext = ctx.roundsLeft > 0 ? Math.max(0.15, PARAMS.nextRoundBase - PARAMS.nextRoundPerTile * need) : 0;
  return pThis + (1 - pThis) * pNext;
}

export interface PlayerFeatures {
  /** Puntos asegurados: marcador + alicatado pendiente - suelo. */
  base: number;
  pending: number;
  floor: number;
  potencialLinea: number;
  lineaBloqueada: number;
  progresoFila: number;
  progresoColumna: number;
  progresoColor: number;
  adyacenciaFutura: number;
}

function feasibility(need: number, capacity: number): number {
  if (need <= 0) return 1;
  if (need <= capacity) return 1;
  if (need <= capacity + 1) return 0.3;
  return 0;
}

function floorSlotsPenalty(p: PlayerState): number {
  return floorPenalty(p.floor.length);
}

/** Rasgos estáticos de un jugador en una posición. */
export function playerFeatures(p: PlayerState, ctx: Context): PlayerFeatures {
  const { wall, points } = pendingTiling(p);
  const R = ctx.roundsLeft;
  let potencial = 0;
  let bloqueada = 0;
  const rowFrac = [0, 0, 0, 0, 0];
  const colFrac = [0, 0, 0, 0, 0];
  const colorFrac = [0, 0, 0, 0, 0];
  for (let r = 0; r < 5; r++) {
    const n = p.lineCount[r];
    if (n === 0 || n === r + 1) continue;
    const c = p.lineColor[r];
    const need = r + 1 - n;
    const P = completionChance(need, c, ctx);
    const col = wallCol(r, c);
    const pts = placementScore(wall | bit(r, col), r, col).points;
    potencial += P * pts;
    const dead = R === 0 ? 1.6 : 1;
    bloqueada -= (1 - P) * (PARAMS.blockedBase + PARAMS.blockedPerTile * n) * dead;
    const frac = P * (n / (r + 1));
    rowFrac[r] += frac;
    colFrac[col] += frac;
    colorFrac[c] += frac;
  }
  let fila = 0;
  let columna = 0;
  let color = 0;
  for (let i = 0; i < 5; i++) {
    const kr = rowCount(wall, i) + rowFrac[i];
    fila += ROW_BONUS * (kr / 5) ** 2 * feasibility(5 - Math.ceil(kr - 1e-9), R);
    const kc = colCount(wall, i) + colFrac[i];
    columna += COL_BONUS * (kc / 5) ** 2 * feasibility(5 - Math.ceil(kc - 1e-9), 2 * R);
    const kk = colorCount(wall, i) + colorFrac[i];
    color += COLOR_BONUS * (kk / 5) ** 2 * feasibility(5 - Math.ceil(kk - 1e-9), 2 * R);
  }
  let ady = 0;
  if (R > 0) {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (wall & bit(r, c)) continue;
        let nb = 0;
        if (c > 0 && wall & bit(r, c - 1)) nb++;
        if (c < 4 && wall & bit(r, c + 1)) nb++;
        if (r > 0 && wall & bit(r - 1, c)) nb++;
        if (r < 4 && wall & bit(r + 1, c)) nb++;
        ady += Math.min(nb, 3) * PARAMS.adjacencyPerNeighbor;
      }
    }
    ady *= Math.min(1, R / 2);
  }
  const floor = floorSlotsPenalty(p);
  return {
    base: p.score + points - floor,
    pending: points,
    floor,
    potencialLinea: potencial,
    lineaBloqueada: bloqueada,
    progresoFila: fila,
    progresoColumna: columna,
    progresoColor: color,
    adyacenciaFutura: ady,
  };
}

export function hasFirstToken(p: PlayerState): boolean {
  return p.floor.includes(FIRST_TOKEN);
}

/** Valor estático de un jugador (puntos esperados al final). */
export function playerValue(p: PlayerState, ctx: Context): number {
  const f = playerFeatures(p, ctx);
  return f.base + f.potencialLinea + f.lineaBloqueada + f.progresoFila + f.progresoColumna + f.progresoColor + f.adyacenciaFutura;
}

/** Valor de cada jugador en una posición (puntuación final exacta si la partida ha terminado). */
export function stateValues(s: GameState): number[] {
  if (s.phase === 'over') return s.players.map((p) => p.score);
  const ctx = contextOf(s);
  return s.players.map((p) => playerValue(p, ctx));
}

export function totalTilesOnTable(s: GameState): number {
  let t = sum(s.center);
  for (const f of s.factories) t += sum(f);
  return t;
}
