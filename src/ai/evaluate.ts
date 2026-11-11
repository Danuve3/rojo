import {
  applyTurn, cloneState, FIRST_TOKEN, floorPenalty, type GameState, type Move, rowCount, sum,
} from '../engine';
import { emptyFactors, FACTOR_NAMES, type Factors } from './factors';
import { contextOf, type Context, pendingTiling, playerFeatures, type PlayerFeatures, playerValue } from './features';
import { bestQuickResponse } from './quick';
import { PARAMS, WEIGHTS } from './weights';

export interface RivalInfo {
  player: number;
  color: number;
  count: number;
  gain: number;
}

export interface Evaluation {
  total: number;
  factores: Factors;
  rival: RivalInfo | null;
}

export interface EvalOptions {
  /** Calcula la respuesta de los rivales (denegación). */
  rivals?: boolean;
}

/** Datos de la posición de partida reutilizables entre jugadas. */
export interface EvalBase {
  state: GameState;
  player: number;
  ctx: Context;
  features: PlayerFeatures;
  rivalBefore: number[];
  lead: number;
  endTriggered: boolean;
}

function endTriggered(s: GameState): boolean {
  return s.players.some((p) => pendingTiling(p).rowsDone > 0);
}

export function prepareEval(s: GameState, opts: EvalOptions = {}): EvalBase {
  const player = s.current;
  const ctx = contextOf(s);
  const values = s.players.map((p) => playerValue(p, ctx));
  const others = values.filter((_, i) => i !== player);
  const rivalBefore = s.players.map((_, q) =>
    q === player || !opts.rivals ? 0 : bestQuickResponse(s, q).value);
  return {
    state: s,
    player,
    ctx,
    features: playerFeatures(s.players[player], ctx),
    rivalBefore,
    lead: values[player] - Math.max(...others),
    endTriggered: endTriggered(s),
  };
}

function rivalFactor(base: EvalBase, after: GameState): { value: number; info: RivalInfo | null } {
  const n = after.numPlayers;
  let total = 0;
  let info: RivalInfo | null = null;
  let worst = -Infinity;
  for (let k = 1; k < n; k++) {
    const q = (base.player + k) % n;
    const r = bestQuickResponse(after, q);
    const delta = r.value - base.rivalBefore[q];
    total += delta * (k === 1 ? PARAMS.denyNext : PARAMS.denyOthers);
    if (r.move && r.value > worst) {
      worst = r.value;
      const src = r.move.source === 'center' ? after.center : after.factories[r.move.source];
      info = { player: q, color: r.move.color, count: src[r.move.color], gain: r.value };
    }
  }
  // Fin de ronda: si la mesa queda vacía no hay respuesta posible.
  if (sum(after.center) === 0 && after.factories.every((f) => sum(f) === 0)) return { value: 0, info: null };
  return { value: -total, info };
}

function controlFinal(base: EvalBase, after: GameState): number {
  const me = after.players[base.player];
  const before = base.state.players[base.player];
  const lead = Math.max(-PARAMS.endLeadCap, Math.min(PARAMS.endLeadCap, base.lead));
  const triggersNow = !base.endTriggered && pendingTiling(me).rowsDone > 0;
  if (triggersNow) return lead * PARAMS.endLeadScale * 2;
  // Acercar el final: filas con 4 que quedan a una ronda de cerrarse.
  const near = (w: number) => [0, 1, 2, 3, 4].filter((r) => rowCount(w, r) >= 4).length;
  const d = near(pendingTiling(me).wall) - near(pendingTiling(before).wall);
  return d * lead * PARAMS.endLeadScale * 0.4;
}

/** Evalúa una jugada y descompone su valor en factores con nombre. */
export function evaluateWith(base: EvalBase, m: Move, opts: EvalOptions = {}): Evaluation {
  const s = base.state;
  const after = cloneState(s);
  const before = s.players[base.player];
  const turn = applyTurn(after, m);
  const ctxAfter = contextOf(after);
  const fb = base.features;
  const fa = playerFeatures(after.players[base.player], ctxAfter);
  const f = emptyFactors();
  f.puntosInmediatos = fa.pending - fb.pending;
  const L = before.floor.length;
  const tokenSlot = turn.tookFirst && L < 7 ? 1 : 0;
  const tokenPen = floorPenalty(L + tokenSlot) - floorPenalty(L);
  f.penalizacionSuelo = -(fa.floor - fb.floor - tokenPen);
  f.fichaInicial = turn.tookFirst ? -tokenPen + (ctxAfter.roundsLeft > 0 ? PARAMS.firstTokenValue : 0) : 0;
  f.potencialLinea = fa.potencialLinea - fb.potencialLinea;
  f.lineaBloqueada = fa.lineaBloqueada - fb.lineaBloqueada;
  f.progresoFila = fa.progresoFila - fb.progresoFila;
  f.progresoColumna = fa.progresoColumna - fb.progresoColumna;
  f.progresoColor = fa.progresoColor - fb.progresoColor;
  f.adyacenciaFutura = fa.adyacenciaFutura - fb.adyacenciaFutura;
  let rival: RivalInfo | null = null;
  if (opts.rivals) {
    const r = rivalFactor(base, after);
    f.regaloRival = r.value;
    rival = r.info;
  }
  f.controlFinal = controlFinal(base, after);
  let total = 0;
  for (const name of FACTOR_NAMES) {
    f[name] *= WEIGHTS[name];
    total += f[name];
  }
  return { total, factores: f, rival };
}

export function evaluate(s: GameState, m: Move, opts: EvalOptions = {}): Evaluation {
  return evaluateWith(prepareEval(s, opts), m, opts);
}

export function tokenOnFloor(s: GameState, player: number): boolean {
  return s.players[player].floor.includes(FIRST_TOKEN);
}
