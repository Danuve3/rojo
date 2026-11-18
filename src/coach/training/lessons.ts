import type { Puzzle, Theme } from './generate';
import data from './lessons-data.json';

export interface Lesson {
  id: Theme;
  title: string;
  /** Una frase que resume la idea. */
  summary: string;
  /** Explicación en párrafos cortos. */
  body: string[];
  /** Reglas prácticas para la partida. */
  tips: string[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'suelo',
    title: 'El suelo no perdona',
    summary: 'Cada loseta que cae al suelo te cuesta puntos seguros, y cada vez más.',
    body: [
      'Las penalizaciones del suelo crecen: las dos primeras quitan 1, las tres siguientes 2 y las dos últimas 3. Siete losetas en el suelo son 14 puntos: una ronda entera de trabajo.',
      'Casi todos los puntos que pierden los jugadores de nivel medio se van por aquí. No es mala suerte: es coger montones que no caben.',
      'Antes de confirmar, mira cuántas losetas caben en la línea. Si el montón es más grande, busca una línea más larga, otro montón del mismo color o espera a que crezca en el centro.',
    ],
    tips: [
      'Prefiere montones que llenen una línea justa a montones grandes que la desborden.',
      'Ten siempre una línea larga a medio llenar como «colchón» para el final de la ronda.',
      'Al final de la ronda, coge pronto lo pequeño: lo último que queda suele ser un montón grande que alguien tendrá que tragarse.',
    ],
  },
  {
    id: 'adyacencia',
    title: 'Construye en racimo',
    summary: 'Una loseta junto a otras puntúa por toda la fila y la columna que toca.',
    body: [
      'Una loseta aislada vale 1 punto. Pegada a otras vale la longitud de su tramo horizontal más la del vertical, contándose a sí misma en ambos. En el centro de una cruz puede valer 10.',
      'Por eso importa en qué casilla del muro acabará cada línea. Dos jugadas que completan una línea pueden valer 1 o 6 puntos según dónde caiga la loseta.',
      'Los buenos jugadores sacan más de 3,5 puntos por loseta colocada. Si tú sacas menos de 3, tu muro está demasiado disperso.',
    ],
    tips: [
      'Antes de elegir línea, mira la casilla del muro donde caerá esa loseta.',
      'Empieza por el centro del muro: la casilla central tiene más vecinas posibles.',
      'Completa primero las líneas cuya loseta toca a otras ya colocadas.',
    ],
  },
  {
    id: 'bonus',
    title: 'Columnas y colores',
    summary: 'Los bonus finales deciden las partidas: +7 por columna, +10 por color.',
    body: [
      'Una columna completa vale 7 puntos al final y un color completo 10. Una fila solo 2, pero es la que cierra la partida.',
      'Un muro con dos columnas a falta de una loseta no vale nada extra: los bonus solo cuentan completos. Elige pronto qué columna vas a cerrar y no la abandones.',
      'Las columnas exigen una loseta de cada línea, también de las largas. Llenar líneas de 4 y 5 a tiempo es lo que permite cerrar columnas.',
    ],
    tips: [
      'Desde la ronda 2, decide una columna objetivo (mejor las centrales) y mete una loseta por ronda.',
      'Un color repartido en filas distintas suele ir camino del bonus de color: aprovéchalo.',
      'Cuando la partida está cerca del final, cuenta qué bonus puedes completar todavía y juega solo a esos.',
    ],
  },
  {
    id: 'denegacion',
    title: 'Juega también el tablero del rival',
    summary: 'Lo que dejas en la mesa puede ser justo lo que tu rival necesita.',
    body: [
      'Cuando coges de un expositor, el resto va al centro. Si ese resto completa la línea de un rival, le acabas de hacer un regalo.',
      'A veces la mejor jugada no es la que más te da, sino la que le quita a otro una línea completa o le obliga a tirar losetas al suelo.',
      'Mira las líneas a medio llenar de tus rivales: te dicen qué colores necesitan y cuántos.',
    ],
    tips: [
      'Antes de coger, mira qué caerá al centro y si completa la línea de alguien.',
      'Si dudas entre dos jugadas parecidas, elige la que deja peor al siguiente rival.',
      'Toca el tablero de un rival para verlo en grande: es gratis y gana partidas.',
    ],
  },
  {
    id: 'ficha',
    title: 'La ficha inicial',
    summary: 'Empezar la ronda tiene valor, pero ocupa un hueco del suelo.',
    body: [
      'Quien coge primero del centro se lleva la ficha «1»: empieza la ronda siguiente, pero esa ficha ocupa un hueco del suelo y resta como una loseta.',
      'Empezar vale más cuando hay un expositor que te viene muy bien, o cuando necesitas un color concreto antes que nadie.',
      'Cogerla con un montón pequeño que no necesitas es pagar por nada.',
    ],
    tips: [
      'Coge del centro primero solo si el montón te completa algo o te viene muy bien.',
      'Si tu suelo ya tiene losetas, la ficha te cuesta más (las penalizaciones crecen).',
      'En la última ronda empezar la siguiente no vale nada: no pagues por la ficha.',
    ],
  },
  {
    id: 'final',
    title: 'Cerrar la partida',
    summary: 'En la última ronda cambian las prioridades: cuentan los bonus y el marcador.',
    body: [
      'La partida acaba al terminar la ronda en la que alguien completa una fila. En esa ronda, las líneas a medias ya no sirven para nada: solo cuenta lo que se alicata ahora y los bonus.',
      'Si vas por delante, te interesa acabar cuanto antes. Si vas por detrás, quizá te conviene no completar esa fila y alargar la partida.',
      'Al final de la ronda alguien tendrá que tragarse lo que sobra. Cuenta las losetas que quedan para no ser tú.',
    ],
    tips: [
      'En la última ronda, no empieces líneas que no puedas completar ya.',
      'Prioriza las losetas que cierran columnas o colores: son 7 o 10 puntos de golpe.',
      'Mira el marcador antes de poner la quinta loseta de una fila.',
    ],
  },
];

const EXERCISES = data as unknown as Record<string, Puzzle[]>;

export function lessonExercises(id: Theme): Puzzle[] {
  return EXERCISES[id] ?? [];
}
