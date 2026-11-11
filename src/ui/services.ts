import type { BotProvider, CoachProvider } from './gameController';
import type { SoundName } from './gameView';

/** Registro de servicios (bots, entrenador, audio) que se configura en main.ts. */
export const services = {
  bots: (): BotProvider => {
    throw new Error('bots sin configurar');
  },
  coach: (): CoachProvider | null => null,
  sound: (_name: SoundName, _opts?: { step?: number; bot?: boolean }): void => undefined,
  haptic: (_p: number | number[]): void => undefined,
};
