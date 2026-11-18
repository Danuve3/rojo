export interface PlayerConfig {
  kind: 'human' | 'bot';
  name: string;
  level: number;
}

export interface CoachConfig {
  enabled: boolean;
  hints: boolean;
  verdicts: boolean;
  verdictMode: 'always' | 'mistakes';
  review: boolean;
}

/** Ayudas de entrenamiento dentro de la partida. */
export interface TrainingConfig {
  /** Reto activo sacado de «Para tus próximas partidas». */
  challenge: boolean;
  /** Con 💡, elegir primero tu jugada candidata. */
  predict: boolean;
  /** Tras un fallo, reintentar antes de ver la solución. */
  secondChance: boolean;
  /** Explicar las jugadas de los bots fuertes. */
  explainBots: boolean;
  /** Preguntar a veces qué cogerá el rival. */
  guessRival: boolean;
  /** Preguntas de conteo de losetas. */
  counting: boolean;
  /** Mostrar cuántas losetas de cada color faltan por salir. */
  bagCounter: boolean;
  /** Sin avisos de suelo ni vista previa. */
  noAids: boolean;
}

export const DEFAULT_TRAINING: TrainingConfig = {
  challenge: true,
  predict: true,
  secondChance: true,
  explainBots: true,
  guessRival: false,
  counting: false,
  bagCounter: false,
  noAids: false,
};

export interface GameConfig {
  players: PlayerConfig[];
  starter: number;
  coach: CoachConfig;
  seed: number;
  /** Ausente en partidas guardadas antes de la v1.2. */
  training?: TrainingConfig;
  /** 'final': partida del entrenador de finales (no cuenta en el historial). */
  mode?: 'normal' | 'final';
}

export function trainingOf(c: GameConfig): TrainingConfig {
  return { ...DEFAULT_TRAINING, ...(c.training ?? {}) };
}

export const HUMAN = 0;

export const DEFAULT_COACH: CoachConfig = {
  enabled: true,
  hints: true,
  verdicts: true,
  verdictMode: 'always',
  review: true,
};

const NAMES = [
  'Lúcia', 'Bento', 'Amália', 'Duarte', 'Graça', 'Tomé', 'Leonor', 'Vasco', 'Rosário', 'Simão', 'Inês', 'Afonso',
  'Matilde', 'Gaspar', 'Filipa', 'Rui', 'Constança', 'Henrique', 'Benedita', 'Nuno', 'Teresa', 'Lourenço', 'Carmo', 'Xavier',
];
const EPITHETS = ['la Alfarera', 'el Vidriado', 'la Esmaltada', 'el del Horno', 'la de Sintra', 'el Cobalto', 'la Tesela', 'el Mosaico', 'la Celosía', 'el Barniz'];

export function botNames(n: number, rnd: () => number = Math.random): string[] {
  const pool = NAMES.slice();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const name = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    out.push(rnd() < 0.35 ? `${name} ${EPITHETS[Math.floor(rnd() * EPITHETS.length)]}` : name);
  }
  return out;
}
