import { kvGet, kvSet } from './db';

export type AnimSpeed = 'normal' | 'fast' | 'instant';
export type BotSpeed = 'slow' | 'normal' | 'fast';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  volume: number;
  muted: boolean;
  music: boolean;
  haptics: boolean;
  animSpeed: AnimSpeed;
  botSpeed: BotSpeed;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  muted: false,
  music: false,
  haptics: true,
  animSpeed: 'normal',
  botSpeed: 'normal',
  theme: 'system',
};

let current: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(s: Settings) => void>();

export async function loadSettings(): Promise<Settings> {
  const stored = await kvGet<Partial<Settings>>('settings');
  current = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  return current;
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  void kvSet('settings', current);
  listeners.forEach((l) => l(current));
}

export function onSettings(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
