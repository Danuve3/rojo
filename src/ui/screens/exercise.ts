import { describeMove } from '../../coach/explain';
import type { Verdict } from '../../coach/types';
import { LABEL_ICON, LABEL_TEXT } from '../../coach/verdict';
import type { GameState, Move } from '../../engine';
import type { App } from '../app';
import { DEFAULT_COACH, type GameConfig, HUMAN } from '../config';
import { h } from '../dom';
import { GameView } from '../gameView';
import { services } from '../services';

export interface Exercise {
  state: GameState;
  /** Contexto corto, p. ej. «Fallaste aquí en la ronda 3». */
  context?: string;
}

export interface ExerciseSession {
  title: string;
  items: Exercise[];
  /** Vuelta al terminar o al salir. */
  back: string;
  /** Resultado de cada ejercicio (acierto al primer intento). */
  onResult(index: number, correct: boolean, loss: number): void | Promise<void>;
  onFinish?(correct: number, total: number): void | Promise<void>;
}

let session: ExerciseSession | null = null;

export function startExercises(app: App, s: ExerciseSession): void {
  session = s;
  app.go('exercise');
}

/** Tolerancia: una jugada que pierde menos de esto frente a la mejor cuenta como acierto. */
const OK_LOSS = 0.5;
const RATE_MS = 1000;

function configFor(n: number): GameConfig {
  return {
    players: Array.from({ length: n }, (_, i) => (i === HUMAN ? { kind: 'human' as const, name: 'Tú', level: 0 } : { kind: 'bot' as const, name: `Rival ${i}`, level: 0 })),
    starter: 0,
    coach: DEFAULT_COACH,
    seed: 0,
  };
}

const src = (s: GameState, m: Move) => (m.source === 'center' ? s.center : s.factories[m.source])[m.color];

export function exerciseScreen(root: HTMLElement, app: App): () => void {
  const sess = session;
  if (!sess || !sess.items.length) {
    app.go('train');
    return () => undefined;
  }
  let alive = true;
  let index = 0;
  let correctCount = 0;
  let attempts = 0;
  let view: GameView | null = null;
  let size = 0;

  const names = (n: number) => configFor(n).players.map((p) => p.name);

  function mountFor(n: number): GameView {
    view?.destroy();
    const v = new GameView(configFor(n), {
      onMove: (m) => void check(m),
      onPredict: () => undefined,
      onGuess: () => undefined,
      onSkip: () => undefined,
      onHint: () => undefined,
      onUndo: () => undefined,
      onExit: () => app.go(sess!.back),
      sound: (nm, o) => services.sound(nm, o),
      haptic: (p) => services.haptic(p),
    });
    v.mount(root);
    v.hintBtn.hidden = true;
    v.undoBtn.hidden = true;
    size = n;
    return v;
  }

  function panel(...children: Array<Node | null>): void {
    if (!view) return;
    const v = view;
    const nodes = children.filter((c): c is Node => c !== null);
    // Botón de cerrar en la cabecera: el panel puede tapar los tableros de los rivales.
    const head = nodes[0];
    if (head instanceof HTMLElement && head.classList.contains('hp-head')) {
      const close = h('button', { class: 'icon-btn sm close', 'aria-label': 'Ocultar' }, '×');
      close.addEventListener('click', () => (v.hintPanel.hidden = true));
      head.append(close);
    }
    v.hintPanel.replaceChildren(...nodes);
    v.hintPanel.hidden = false;
  }

  function show(): void {
    const ex = sess!.items[index];
    if (!view || size !== ex.state.numPlayers) view = mountFor(ex.state.numPlayers);
    attempts = 0;
    void view.showPosition(ex.state, false).then(() => {
      if (!alive || !view) return;
      view.markTarget(0, null);
      view.enableInput(ex.state);
      view.setStatus(`${sess!.title} · ${index + 1} de ${sess!.items.length}: encuentra la mejor jugada`);
      panel(
        h('div', { class: 'hp-head' }, h('strong', {}, `${sess!.title} · ${index + 1}/${sess!.items.length}`)),
        ex.context ? h('p', { class: 'small muted' }, ex.context) : null,
        h('p', { class: 'small' }, 'Te toca. Elige color y línea como en una partida: el entrenador comprobará tu jugada.'));
      // Las instrucciones se apartan en cuanto empiezas a jugar.
      const v = view;
      v.el.addEventListener('pointerdown', (e) => {
        if (!(e.target as HTMLElement).closest('.hint-panel')) v.hintPanel.hidden = true;
      }, { once: true, capture: true });
    });
  }

  async function check(m: Move): Promise<void> {
    const ex = sess!.items[index];
    if (!view) return;
    attempts++;
    view.setStatus('Comprobando…', true);
    view.markTarget(0, m.target);
    const v = await services.analysis().call<Verdict | null>({ type: 'rate', state: ex.state, move: m, names: names(ex.state.numPlayers), budgetMs: RATE_MS }).promise.catch(() => null);
    if (!alive || !view) return;
    const loss = v ? v.loss : 0;
    const ok = !v || loss <= OK_LOSS;
    if (attempts === 1) {
      if (ok) correctCount++;
      await sess!.onResult(index, ok, loss);
    }
    services.sound(ok ? 'coachGood' : 'coachWarn');
    view.setStatus('');
    if (ok) {
      const exact = v && v.loss < 0.05;
      panel(
        h('div', { class: 'hp-head' }, h('strong', {}, attempts === 1 ? '★ ¡Correcto!' : '✓ Ahora sí')),
        h('p', { class: 'small' }, describeMove(m, src(ex.state, m)), exact ? ' es la mejor jugada.' : ` vale casi lo mismo que la mejor (−${loss.toFixed(1).replace('.', ',')}).`),
        v && !exact ? h('p', { class: 'small muted' }, 'La mejor era: ', describeMove(v.best.move, src(ex.state, v.best.move))) : null,
        nextButton());
      if (attempts === 1) view.celebrate(view.boardEl(HUMAN), 14);
      return;
    }
    const retry = h('button', { class: 'btn small-btn primary' }, 'Reintentar');
    const reveal = h('button', { class: 'btn small-btn' }, 'Ver solución');
    retry.addEventListener('click', () => {
      if (!view) return;
      view.markTarget(0, null);
      view.enableInput(ex.state);
      view.setStatus('Prueba otra jugada');
      view.hintPanel.hidden = true;
    });
    reveal.addEventListener('click', () => solution(v as Verdict));
    panel(
      h('div', { class: 'hp-head' }, h('strong', {}, `${LABEL_ICON[(v as Verdict).label]} ${LABEL_TEXT[(v as Verdict).label]}`)),
      h('p', { class: 'small' }, `Tu jugada pierde ~${loss.toFixed(1).replace('.', ',')} frente a la mejor. ¿Buscas otra?`),
      h('div', { class: 'v-actions' }, retry, reveal));
  }

  function solution(v: Verdict): void {
    const ex = sess!.items[index];
    if (!view) return;
    view.disableInput();
    view.markTarget(0, v.best.move.target);
    panel(
      h('div', { class: 'hp-head' }, h('strong', {}, 'Solución')),
      h('p', { class: 'small' }, h('b', {}, 'Mejor: '), describeMove(v.best.move, src(ex.state, v.best.move))),
      v.reasons.length ? h('ul', { class: 'small' }, ...v.reasons.map((r) => h('li', {}, r))) : null,
      nextButton());
  }

  function nextButton(): HTMLElement {
    const last = index === sess!.items.length - 1;
    const b = h('button', { class: 'btn small-btn primary' }, last ? 'Terminar' : 'Siguiente');
    b.addEventListener('click', () => {
      if (last) void finish();
      else {
        index++;
        show();
      }
    });
    return h('div', { class: 'v-actions' }, b);
  }

  async function finish(): Promise<void> {
    await sess!.onFinish?.(correctCount, sess!.items.length);
    if (!alive || !view) return;
    view.disableInput();
    const back = h('button', { class: 'btn small-btn primary' }, 'Volver');
    back.addEventListener('click', () => app.go(sess!.back));
    panel(
      h('div', { class: 'hp-head' }, h('strong', {}, `${sess!.title}: ${correctCount} de ${sess!.items.length}`)),
      h('p', { class: 'small' }, correctCount === sess!.items.length ? 'Todas al primer intento. Muy bien.' : 'Las que no acertaste a la primera volverán en tu repaso.'),
      h('div', { class: 'v-actions' }, back));
  }

  show();
  return () => {
    alive = false;
    view?.destroy();
  };
}
