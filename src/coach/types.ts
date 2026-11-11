import type { GameState, Move } from '../engine';
import type { FactorName } from '../ai/factors';

export type VerdictLabel = 'excelente' | 'buena' | 'imprecision' | 'error' | 'pifia';

export type ErrorTag =
  | 'suelo_evitable'
  | 'regalo_rival'
  | 'linea_bloqueada'
  | 'ficha_inicial_cara'
  | 'ignora_bonus'
  | 'final_mal_gestionado'
  | 'puntos_perdidos';

export interface MoveAnalysis {
  move: Move;
  /** Valor esperado (margen en puntos frente a los rivales). */
  value: number;
  visits: number;
  factors: Record<FactorName, number>;
  /** Contexto para las explicaciones. */
  rival?: { player: number; color: number; count: number; gain: number } | null;
}

export interface Analysis {
  key: string;
  player: number;
  moves: MoveAnalysis[];
  iterations: number;
  ms: number;
}

export interface Verdict {
  label: VerdictLabel;
  loss: number;
  best: MoveAnalysis;
  mine: MoveAnalysis;
  reasons: string[];
  tags: ErrorTag[];
}

export interface MoveRecord {
  round: number;
  turn: number;
  before: GameState;
  move: Move;
  best: Move;
  loss: number;
  label: VerdictLabel;
  reasons: string[];
  tags: ErrorTag[];
}
