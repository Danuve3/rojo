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

export interface GameConfig {
  players: PlayerConfig[];
  starter: number;
  coach: CoachConfig;
  seed: number;
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
