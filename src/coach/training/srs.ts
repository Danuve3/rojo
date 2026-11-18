import type { GameState, Move } from '../../engine';
import type { ErrorTag, VerdictLabel } from '../types';

const DAY = 24 * 60 * 60 * 1000;

/** Tarjeta de repaso: una posición en la que fallaste. */
export interface Card {
  id: string;
  state: GameState;
  played: Move;
  best: Move;
  loss: number;
  label: VerdictLabel;
  tags: ErrorTag[];
  created: number;
  due: number;
  /** Intervalo actual en días. */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
}

export function newCard(id: string, state: GameState, played: Move, best: Move, loss: number, label: VerdictLabel, tags: ErrorTag[], now = Date.now()): Card {
  // La primera vez vuelve al día siguiente: así se repasa en frío.
  return { id, state, played, best, loss, label, tags, created: now, due: now + DAY, interval: 1, ease: 2.5, reps: 0, lapses: 0 };
}

/** Repetición espaciada (estilo SM-2 simplificado): lo que aciertas tarda más en volver. */
export function grade(card: Card, correct: boolean, now = Date.now()): Card {
  if (correct) {
    const interval = card.reps === 0 ? 3 : Math.round(card.interval * card.ease);
    return { ...card, reps: card.reps + 1, interval, ease: Math.min(3, card.ease + 0.1), due: now + interval * DAY };
  }
  return { ...card, reps: 0, lapses: card.lapses + 1, interval: 1, ease: Math.max(1.3, card.ease - 0.2), due: now + DAY };
}

export function isDue(card: Card, now = Date.now()): boolean {
  return card.due <= now;
}

/** Una tarjeta se da por aprendida tras tres aciertos seguidos. */
export function isLearned(card: Card): boolean {
  return card.reps >= 3;
}
