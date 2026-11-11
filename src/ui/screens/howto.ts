import { bit, createPlayer, wallCol } from '../../engine';
import type { App } from '../app';
import { boardSvg } from '../boardSvg';
import { h } from '../dom';
import { COLOR_LABELS, SYMBOL_NAMES, tileSvg } from '../tileArt';
import { screen } from './common';

function exampleBoard() {
  const p = createPlayer();
  p.lineColor = [2, 0, 1, -1, 3];
  p.lineCount = [1, 1, 3, 0, 2];
  p.wall = bit(0, 0) | bit(0, 1) | bit(1, 1) | bit(2, wallCol(2, 4));
  p.floor = [5, 4];
  p.score = 9;
  return p;
}

function adjacencyExample() {
  const p = createPlayer();
  p.wall = bit(2, 1) | bit(2, 2) | bit(2, 3) | bit(1, 2) | bit(3, 2);
  return p;
}

const para = (...t: Array<string | Node>) => h('p', {}, ...t);

export function howtoScreen(root: HTMLElement, app: App): void {
  root.append(screen('Cómo jugar', app,
    h('section', { class: 'card prose' },
      h('h2', {}, 'La idea'),
      para('Eres azulejero en un palacio. Cada ronda te repartes azulejos con tus rivales y los colocas en tu muro. Cuantos más azulejos juntos, más puntos. Lo que no sepas colocar acaba en el suelo… y resta.'),
      h('div', { class: 'legend' }, ...COLOR_LABELS.map((c, i) => h('span', { class: 'legend-item' }, tileSvg(i, 28), `${c} · ${SYMBOL_NAMES[i]}`))),
      para('Cada color lleva su propio dibujo, así que se distinguen aunque no veas bien los colores.')),
    h('section', { class: 'card prose' },
      h('h2', {}, '1. Escoger'),
      para('En tu turno eliges un color de un solo sitio:'),
      h('ul', {},
        h('li', {}, 'De un expositor: te llevas todos los de ese color y el resto del expositor se va al centro.'),
        h('li', {}, 'Del centro: te llevas todos los de ese color. Quien coge del centro por primera vez en la ronda se lleva además la ficha «1», que ocupa un hueco de su suelo pero le hace empezar la ronda siguiente.')),
      para('En la app: toca un color y luego la línea donde quieres ponerlo. Cada línea válida muestra cuántas fichas caben y cuántas caerían al suelo. Toca otra vez la selección o fuera para cancelar.')),
    h('section', { class: 'card prose' },
      h('h2', {}, '2. Colocar'),
      boardSvg(exampleBoard(), { width: 300 }),
      para('A la izquierda tienes 5 líneas de 1 a 5 huecos. Todo lo que cojas va a una sola línea, que debe estar vacía o tener ya ese color, y ese color no puede estar ya en la misma fila del muro.'),
      para('Lo que no cabe cae al suelo: -1, -1, -2, -2, -2, -3, -3. Si el suelo está lleno, lo que sobra se descarta sin más castigo. También puedes tirarlo todo al suelo a propósito.')),
    h('section', { class: 'card prose' },
      h('h2', {}, '3. Alicatar'),
      para('Cuando no quedan azulejos en la mesa, cada línea completa manda uno al muro (a la casilla de su color) y el resto se descarta. Las líneas a medias esperan a la siguiente ronda.'),
      boardSvg(adjacencyExample(), { width: 300, highlightWall: [11, 12, 13, 7, 17] }),
      para('Puntos de cada azulejo nuevo: 1 si queda solo. Si toca a otros, suma la longitud de su tramo horizontal y la de su tramo vertical (contándose a sí mismo en ambos). En el ejemplo, el azulejo central vale 3 + 3 = 6.'),
      para('Después se restan las penalizaciones del suelo (tu marcador nunca baja de 0).')),
    h('section', { class: 'card prose' },
      h('h2', {}, '4. Final'),
      para('La partida acaba al terminar la ronda en la que alguien completa una fila horizontal del muro. Entonces se suman los bonus:'),
      h('ul', {}, h('li', {}, '+2 por cada fila completa'), h('li', {}, '+7 por cada columna completa'), h('li', {}, '+10 por cada color con sus 5 azulejos')),
      para('Gana quien más puntos tenga; si empatan, quien tenga más filas completas. Si aún así empatan, comparten la victoria.')),
    h('section', { class: 'card prose' },
      h('h2', {}, 'Consejos'),
      h('ul', {},
        h('li', {}, 'Construye desde el centro del muro: las casillas centrales tienen más vecinas.'),
        h('li', {}, 'Mira qué necesitan tus rivales antes de dejar azulejos en el centro.'),
        h('li', {}, 'Las columnas valen mucho (+7). Llenar líneas largas pronto da margen.'),
        h('li', {}, 'Al final de la ronda alguien tendrá que tragarse lo que sobra: intenta que no seas tú.')))));
}
