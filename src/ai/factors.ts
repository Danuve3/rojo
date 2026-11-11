export const FACTOR_NAMES = [
  'puntosInmediatos',
  'penalizacionSuelo',
  'potencialLinea',
  'lineaBloqueada',
  'progresoFila',
  'progresoColumna',
  'progresoColor',
  'adyacenciaFutura',
  'fichaInicial',
  'regaloRival',
  'controlFinal',
] as const;

export type FactorName = (typeof FACTOR_NAMES)[number];
export type Factors = Record<FactorName, number>;

export function emptyFactors(): Factors {
  return Object.fromEntries(FACTOR_NAMES.map((n) => [n, 0])) as Factors;
}
