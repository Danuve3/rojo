/** Colores: índices 0..4. La ficha de jugador inicial se representa con FIRST_TOKEN. */
export type Color = 0 | 1 | 2 | 3 | 4;
export type Source = number | 'center';
export type Target = 0 | 1 | 2 | 3 | 4 | 'floor';

export interface Move {
  source: Source;
  color: Color;
  target: Target;
}

export interface PlayerState {
  /** Color de cada línea de patrón (-1 si está vacía). */
  lineColor: number[];
  /** Losetas en cada línea de patrón. */
  lineCount: number[];
  /** Muro como máscara de bits: bit (fila * 5 + col). */
  wall: number;
  /** Suelo: colores o FIRST_TOKEN, máximo 7 huecos. */
  floor: number[];
  score: number;
}

export type Phase = 'playing' | 'over';

export interface GameState {
  numPlayers: number;
  players: PlayerState[];
  /** Cada expositor guarda el número de losetas de cada color. */
  factories: number[][];
  center: number[];
  centerHasFirst: boolean;
  bag: number[];
  box: number[];
  current: number;
  round: number;
  /** Quién empezó la ronda actual. */
  roundStarter: number;
  /** Quién se ha llevado la ficha inicial esta ronda (-1 si nadie). */
  firstTaker: number;
  phase: Phase;
  /** Estado del RNG mulberry32 (oculto para la IA: se baraja al determinizar). */
  rng: number;
  turn: number;
}

export interface TurnResult {
  move: Move;
  player: number;
  taken: number;
  toLine: number;
  toFloor: number;
  toBox: number;
  tookFirst: boolean;
  /** Losetas por color que pasan del expositor al centro. */
  toCenter: number[];
}

export interface Placement {
  player: number;
  row: number;
  col: number;
  color: Color;
  points: number;
  /** Celdas (fila*5+col) que puntúan junto a la nueva loseta. */
  cells: number[];
  scoreAfter: number;
}

export interface FloorPenalty {
  player: number;
  slots: number;
  penalty: number;
  scoreAfter: number;
}

export interface Bonus {
  player: number;
  rows: number;
  cols: number;
  colors: number;
  points: number;
  scoreAfter: number;
}

export interface RoundSummary {
  round: number;
  placements: Placement[];
  penalties: FloorPenalty[];
  gameOver: boolean;
  bonuses: Bonus[];
}
