/** Nombres de colores (sin DOM, utilizable desde el worker). */
export const COLOR_NAMES = ['cobalto', 'ocre', 'rojo', 'tinta', 'marfil'] as const;
export const COLOR_NAMES_PLURAL = ['cobaltos', 'ocres', 'rojos', 'tintas', 'marfiles'] as const;
export const COLOR_LABELS = ['Cobalto', 'Ocre', 'Rojo', 'Tinta', 'Marfil'] as const;
export const SYMBOL_NAMES = ['flor', 'rombo', 'estrella', 'anillo', 'celosía'] as const;

export function colorCount(n: number, c: number): string {
  return `${n} ${n === 1 ? COLOR_NAMES[c] : COLOR_NAMES_PLURAL[c]}`;
}
