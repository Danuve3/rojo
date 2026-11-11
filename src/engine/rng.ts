/** RNG mulberry32 con estado serializable. */
export interface RngHolder {
  rng: number;
}

export function nextRandom(h: RngHolder): number {
  let t = (h.rng = (h.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type Rng = () => number;

export function createRng(seed: number): Rng {
  const h: RngHolder = { rng: seed | 0 };
  return () => nextRandom(h);
}

export function randomSeed(): number {
  return (Math.random() * 0x100000000) | 0;
}
