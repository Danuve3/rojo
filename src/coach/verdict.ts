import type { FactorName } from '../ai/factors';
import { WEIGHTS } from '../ai/weights';
import type { ErrorTag, VerdictLabel } from './types';

/**
 * Escala del margen del MCTS a puntos reales. Calibrada con el torneo: el margen medio
 * real de nivel 10 frente a los niveles 7, 5 y 3 (≈0,6 / 0,8 / 1,4 puntos por jugada)
 * es unas 3–4 veces menor que la pérdida media bruta que estima el MCTS para esos niveles,
 * porque los rollouts amplifican las consecuencias de cada jugada.
 */
export const VALUE_SCALE = 0.3;

/** Umbrales de pérdida de valor esperado (puntos). Calibrados con el torneo. */
export const THRESHOLDS: Array<{ label: VerdictLabel; max: number }> = [
  { label: 'excelente', max: 0.3 },
  { label: 'buena', max: 1 },
  { label: 'imprecision', max: 2.5 },
  { label: 'error', max: 5 },
  { label: 'pifia', max: Infinity },
];

export const LABEL_TEXT: Record<VerdictLabel, string> = {
  excelente: 'Excelente',
  buena: 'Buena',
  imprecision: 'Imprecisión',
  error: 'Error',
  pifia: 'Pifia',
};

export const LABEL_ICON: Record<VerdictLabel, string> = {
  excelente: '★',
  buena: '✓',
  imprecision: '?!',
  error: '?',
  pifia: '??',
};

export function labelFor(loss: number): VerdictLabel {
  for (const t of THRESHOLDS) if (loss <= t.max) return t.label;
  return 'pifia';
}

export function isMistake(label: VerdictLabel): boolean {
  return label === 'imprecision' || label === 'error' || label === 'pifia';
}

export const TAG_OF_FACTOR: Record<FactorName, ErrorTag> = {
  puntosInmediatos: 'puntos_perdidos',
  penalizacionSuelo: 'suelo_evitable',
  potencialLinea: 'linea_bloqueada',
  lineaBloqueada: 'linea_bloqueada',
  progresoFila: 'ignora_bonus',
  progresoColumna: 'ignora_bonus',
  progresoColor: 'ignora_bonus',
  adyacenciaFutura: 'ignora_bonus',
  fichaInicial: 'ficha_inicial_cara',
  regaloRival: 'regalo_rival',
  controlFinal: 'final_mal_gestionado',
};

export const TAG_INFO: Record<ErrorTag, { name: string; tip: string }> = {
  suelo_evitable: {
    name: 'Suelo evitable',
    tip: 'Antes de coger, cuenta cuántas caben en la línea. Si sobran, busca una línea más larga o un montón más pequeño.',
  },
  regalo_rival: {
    name: 'Regalos al rival',
    tip: 'Mira las líneas de los rivales: lo que sobra de un expositor va al centro y puede completarles una línea.',
  },
  linea_bloqueada: {
    name: 'Líneas atascadas',
    tip: 'Empieza líneas que puedas cerrar: comprueba cuántas losetas de ese color quedan en la mesa.',
  },
  ficha_inicial_cara: {
    name: 'Ficha inicial cara',
    tip: 'La ficha «1» cuesta un hueco del suelo. Cógela cuando te lleves un buen botín o cuando empezar importe de verdad.',
  },
  ignora_bonus: {
    name: 'Bonus olvidados',
    tip: 'Las columnas (+7) y los colores (+10) deciden partidas. Agrupa losetas y apunta a cerrar columnas centrales.',
  },
  final_mal_gestionado: {
    name: 'Final mal gestionado',
    tip: 'Si vas por delante, acelera el final completando una fila. Si vas por detrás, alarga la partida.',
  },
  puntos_perdidos: {
    name: 'Puntos que se escapan',
    tip: 'Prioriza las jugadas que completan líneas pegadas a losetas que ya tienes: la adyacencia multiplica.',
  },
};

/** Precisión de una jugada (0–100) a partir de su pérdida. */
export function moveAccuracy(loss: number): number {
  return 100 * Math.exp(-Math.max(0, loss) / 1.5);
}

/** Puntos seguros de una jugada: la penalización del suelo (sin peso de calibración). */
export function certainPoints(f: Record<FactorName, number>): number {
  return f.penalizacionSuelo / WEIGHTS.penalizacionSuelo;
}

/** Pérdida: margen escalado, pero nunca menos que los puntos seguros que se pierden. */
export function lossOf(rawValueLoss: number, best: Record<FactorName, number>, mine: Record<FactorName, number>): number {
  return Math.max(0, rawValueLoss, certainPoints(best) - certainPoints(mine));
}
