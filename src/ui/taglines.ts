/** Frases de la pantalla de inicio: humor ácido a costa del jugador. */
export const TAGLINES = [
  'Tu suelo tiene más azulejos que tu muro. Y lo sabes.',
  'El bot de nivel 1 juega al azar. Y aun así te preocupa.',
  'Alicatar no es lo tuyo. Perder, en cambio, se te da de lujo.',
  'Tu abuela pone azulejos mejor que tú. Y lleva diez años muerta.',
  'El entrenador está aquí porque tus padres no pudieron.',
  'Juega offline: así nadie ve cómo pierdes.',
  'Cinco colores. Ni uno combina con tu talento.',
  'Hemos visto bots aleatorios con más estrategia que tú.',
  'Esa columna no se va a completar sola. Ni contigo tampoco.',
  'Precisión del 40 %. Como tus decisiones vitales.',
  'Tirar al suelo no es una estrategia. Es un estilo de vida.',
  'Rojo, como la cara que se te queda al ver el marcador.',
  'Aquí perder es gratis. Lo de la dignidad ya es otro tema.',
  'El modo oscuro no esconde tus errores. Solo los decora.',
  'El bot no tiene sentimientos. Tú, después de esto, tampoco.',
  'Cada loseta que tiras al suelo es un pequeño grito de auxilio.',
  'Tu muro parece un Excel de hacienda: lleno de huecos y deudas.',
  'Deshacer existe porque alguien pensó en ti. Con pena.',
  'Sin conexión, sin excusas, sin remedio.',
  'Pide una pista. Nadie se va a enterar. Bueno, nosotros sí.',
] as const;

/** Índice aleatorio distinto del anterior. */
export function nextTagline(prev: number, rnd: () => number = Math.random): number {
  if (TAGLINES.length < 2) return 0;
  let i = prev;
  while (i === prev) i = Math.floor(rnd() * TAGLINES.length);
  return i;
}
