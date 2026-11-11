import type { Rng } from '../engine';

/**
 * Elige el índice del mejor valor; con probabilidad epsilon, muestrea una alternativa
 * subóptima con softmax según su valor.
 */
export function noisyArgmax(values: number[], epsilon: number, temperature: number, rnd: Rng): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  if (values.length < 2 || epsilon <= 0 || rnd() >= epsilon) return best;
  const t = Math.max(temperature, 1e-3);
  const weights = values.map((v, i) => (i === best ? 0 : Math.exp((v - values[best]) / t)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return best;
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return best;
}
