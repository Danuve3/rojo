import type { FactorName } from './factors';

/**
 * Pesos de la función de evaluación. Todo en "puntos esperados".
 * Calibrados con `npm run tournament` / `npm run calibrate`.
 */
export const WEIGHTS: Record<FactorName, number> = {
  puntosInmediatos: 1,
  penalizacionSuelo: 1,
  potencialLinea: 0.9,
  lineaBloqueada: 1,
  progresoFila: 0.8,
  progresoColumna: 1,
  progresoColor: 1,
  adyacenciaFutura: 1,
  fichaInicial: 1,
  regaloRival: 0.6,
  controlFinal: 1,
};

/** Constantes internas de los factores. */
export const PARAMS = {
  /** Valor de empezar la ronda siguiente. */
  firstTokenValue: 0.9,
  /** Probabilidad base de completar una línea la ronda siguiente. */
  nextRoundBase: 0.85,
  nextRoundPerTile: 0.12,
  /** Coste de una línea que probablemente no se complete. */
  blockedBase: 0.6,
  blockedPerTile: 0.25,
  /** Valor de cada vecina para casillas vacías. */
  adjacencyPerNeighbor: 0.18,
  /** Peso de la denegación para el siguiente rival y el resto. */
  denyNext: 1,
  denyOthers: 0.5,
  /** Control del final: puntos por punto de ventaja (acotado). */
  endLeadScale: 0.45,
  endLeadCap: 9,
};
