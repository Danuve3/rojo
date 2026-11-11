export type BotMode = 'random' | 'greedy' | 'deny' | 'mcts';

export interface LevelParams {
  mode: BotMode;
  /** Probabilidad de elegir una jugada subóptima (muestreada con softmax). */
  epsilon: number;
  temperature: number;
  /** Para niveles aleatorios: sesgo a no tirar al suelo. */
  floorBias: number;
  /** Presupuesto de MCTS en ms. */
  budgetMs: number;
}

const TABLE: Record<number, LevelParams> = {
  1: { mode: 'random', epsilon: 1, temperature: 1, floorBias: 0.5, budgetMs: 0 },
  2: { mode: 'random', epsilon: 1, temperature: 1, floorBias: 0.9, budgetMs: 0 },
  3: { mode: 'greedy', epsilon: 0.4, temperature: 1.6, floorBias: 0, budgetMs: 0 },
  4: { mode: 'greedy', epsilon: 0.26, temperature: 1.1, floorBias: 0, budgetMs: 0 },
  5: { mode: 'greedy', epsilon: 0.2, temperature: 0.8, floorBias: 0, budgetMs: 0 },
  6: { mode: 'deny', epsilon: 0.2, temperature: 0.8, floorBias: 0, budgetMs: 0 },
  7: { mode: 'deny', epsilon: 0.04, temperature: 0.4, floorBias: 0, budgetMs: 0 },
  8: { mode: 'mcts', epsilon: 0.03, temperature: 0.3, floorBias: 0, budgetMs: 200 },
  9: { mode: 'mcts', epsilon: 0.01, temperature: 0.25, floorBias: 0, budgetMs: 600 },
  10: { mode: 'mcts', epsilon: 0, temperature: 0.2, floorBias: 0, budgetMs: 1500 },
};

export function levelParams(level: number): LevelParams {
  const l = Math.max(1, Math.min(10, Math.round(level)));
  return TABLE[l];
}
