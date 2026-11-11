import type { FactorName } from '../ai/factors';
import type { Move } from '../engine';
import { COLOR_NAMES_PLURAL, colorCount } from '../ui/colors';
import type { MoveAnalysis } from './types';

const pts = (n: number) => `${fmt(n)} ${fmt(n) === '1' ? 'punto' : 'puntos'}`;
const fmt = (n: number) => (Math.abs(n) < 0.95 ? Math.abs(n).toFixed(1) : String(Math.round(Math.abs(n)))).replace('.', ',');

export function describeMove(m: Move, count?: number): string {
  const what = count ? colorCount(count, m.color) : COLOR_NAMES_PLURAL[m.color];
  const from = m.source === 'center' ? 'del centro' : `del expositor ${m.source + 1}`;
  const to = m.target === 'floor' ? 'al suelo' : `a la línea ${m.target + 1}`;
  return `${what} ${from} ${to}`;
}

function rivalName(names: string[], player: number): string {
  return names[player] ?? `el jugador ${player + 1}`;
}

/** Explicación de por qué una jugada es peor que la mejor (factor con mayor diferencia). */
function lossReason(f: FactorName, d: number, mine: MoveAnalysis, best: MoveAnalysis, names: string[]): string | null {
  switch (f) {
    case 'penalizacionSuelo':
      return mine.factors.penalizacionSuelo < -0.2
        ? `Pierdes ~${pts(mine.factors.penalizacionSuelo)} por el suelo.`
        : 'La alternativa aprovecha mejor las losetas sin tirarlas.';
    case 'puntosInmediatos':
      return best.move.target !== 'floor'
        ? `La mejor jugada cierra la línea ${best.move.target + 1} y suma ~${fmt(d)} más al alicatar.`
        : `Dejas de sumar ~${pts(d)} esta ronda.`;
    case 'regaloRival': {
      const r = mine.rival;
      if (r && r.count > 0) {
        return `Dejas ${colorCount(r.count, r.color)} a mano de ${rivalName(names, r.player)}, que puede usarlas para cerrar su línea.`;
      }
      return 'Le facilitas la siguiente jugada a un rival.';
    }
    case 'lineaBloqueada':
      return mine.move.target === 'floor'
        ? 'Tus líneas a medias se quedan sin opciones de completarse.'
        : 'Esa línea ya no se puede completar esta ronda: quedan pocas losetas de ese color.';
    case 'potencialLinea':
      return 'La alternativa deja una línea mucho más fácil de completar.';
    case 'progresoFila':
      return 'Te alejas de completar filas (+2 cada una).';
    case 'progresoColumna':
      return 'Descuidas el bonus de columna (+7).';
    case 'progresoColor':
      return 'Descuidas el bonus de color (+10 por los cinco).';
    case 'adyacenciaFutura':
      return 'La alternativa construye un muro más compacto: más puntos por adyacencia luego.';
    case 'fichaInicial':
      return mine.factors.fichaInicial < best.factors.fichaInicial && mine.move.source === 'center'
        ? 'Llevarte ahora la ficha inicial te sale caro.'
        : 'Merecía la pena coger la ficha inicial y empezar la próxima ronda.';
    case 'controlFinal':
      return d > 0 && mine.factors.controlFinal < 0
        ? 'Acercas el final de la partida cuando vas por detrás.'
        : 'Vas por delante: te convenía acelerar el final.';
    default:
      return null;
  }
}

/** Los 2–3 factores con mayor diferencia frente a la mejor jugada. */
export function topLossFactors(mine: MoveAnalysis, best: MoveAnalysis): Array<{ f: FactorName; d: number }> {
  return (Object.keys(best.factors) as FactorName[])
    .map((f) => ({ f, d: best.factors[f] - mine.factors[f] }))
    .filter((x) => x.d >= 0.3)
    .sort((a, b) => b.d - a.d)
    .slice(0, 3);
}

export function explainLoss(mine: MoveAnalysis, best: MoveAnalysis, names: string[]): string[] {
  const reasons = topLossFactors(mine, best)
    .map(({ f, d }) => lossReason(f, d, mine, best, names))
    .filter((r): r is string => !!r);
  const unique = [...new Set(reasons)];
  if (!unique.length) unique.push('Las diferencias son de largo plazo: la simulación prefiere la alternativa.');
  return unique.slice(0, 3);
}

function goodReason(f: FactorName, v: number, m: MoveAnalysis, names: string[]): string | null {
  switch (f) {
    case 'puntosInmediatos':
      return m.move.target !== 'floor' ? `Completa la línea ${m.move.target + 1}: ~${fmt(v)} al alicatar.` : null;
    case 'potencialLinea':
      return 'Deja una línea con buenas opciones de completarse.';
    case 'progresoColumna':
      return 'Avanza hacia un bonus de columna (+7).';
    case 'progresoColor':
      return 'Avanza hacia el bonus de color (+10).';
    case 'progresoFila':
      return 'Avanza una fila del muro.';
    case 'adyacenciaFutura':
      return 'Coloca junto a losetas que ya tienes.';
    case 'fichaInicial':
      return 'Te llevas la ficha inicial a buen precio.';
    case 'regaloRival': {
      const r = m.rival;
      return r ? `No le deja nada jugoso a ${rivalName(names, r.player)}.` : 'Le quita opciones a los rivales.';
    }
    case 'controlFinal':
      return 'Gestiona bien el ritmo del final.';
    default:
      return null;
  }
}

/** Explicación corta de por qué una jugada es buena (para las pistas). */
export function explainGood(m: MoveAnalysis, names: string[]): string {
  const parts: string[] = [];
  if (m.factors.penalizacionSuelo > -0.05 && m.move.target !== 'floor') parts.push('No tira nada al suelo.');
  const ranked = (Object.keys(m.factors) as FactorName[])
    .filter((f) => f !== 'penalizacionSuelo')
    .map((f) => ({ f, v: m.factors[f] }))
    .filter((x) => x.v > 0.25)
    .sort((a, b) => b.v - a.v);
  for (const { f, v } of ranked) {
    const r = goodReason(f, v, m, names);
    if (r && !parts.includes(r)) parts.unshift(r);
    if (parts.length >= 2) break;
  }
  if (m.factors.penalizacionSuelo < -0.2) parts.push(`Asume ~${fmt(m.factors.penalizacionSuelo)} en el suelo, pero compensa.`);
  if (!parts.length) parts.push('La opción más sólida según la simulación.');
  return parts.slice(0, 2).join(' ');
}
