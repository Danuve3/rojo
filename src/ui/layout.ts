export interface Sizes {
  cell: number;
  rivalCell: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Tamaños de celda según el viewport (mobile-first, vertical). */
export function computeSizes(w: number, h: number, rivals: number): Sizes {
  const W = Math.min(w, 560);
  const cell = clamp(Math.min((W - 30) / 10.9, h * 0.042), 20, 46);
  const rivalW = (W - 16 - (rivals - 1) * 6) / rivals;
  const rivalCell = clamp(Math.min((rivalW - 12) / 10.9, h * (rivals === 1 ? 0.017 : 0.0135)), 7, 17);
  return { cell, rivalCell };
}
