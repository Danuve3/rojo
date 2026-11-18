import { describeMove } from '../../coach/explain';
import { criticalMoments, type CriticalMoment, errorBalance, replayPositions, type ReplayStep } from '../../coach/replay';
import type { MoveRecord, Verdict } from '../../coach/types';
import { LABEL_ICON, LABEL_TEXT, labelFor } from '../../coach/verdict';
import type { GameState } from '../../engine';
import { type FullGame, loadFullGame, saveEvals, type StoredEval } from '../../storage/fullgames';
import type { App } from '../app';
import { HUMAN } from '../config';
import { h, s } from '../dom';
import { GameView } from '../gameView';
import { services } from '../services';

let target: { id: number; back: string } | null = null;

/** Abre el análisis de una partida guardada y vuelve a `back` al salir. */
export function openAnalysis(app: App, id: number, back: string): void {
  target = { id, back };
  app.go('analysis');
}

const RATE_MS = 700;

function momentText(mo: CriticalMoment, names: string[]): string {
  const p = fmtAbs(mo.size);
  switch (mo.kind) {
    case 'tu_error': return `Tu error (−${p})`;
    case 'tu_acierto': return `Tu jugada única (+${p})`;
    case 'regalo_rival': return `Regalo de ${names[mo.player]} (+${p})`;
    case 'golpe_rival': return `Jugada única de ${names[mo.player]}`;
  }
}

const fmtAbs = (n: number) => Math.abs(n).toFixed(1).replace('.', ',');

const fmt = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(1).replace('.', ',')}`;

function sourceCount(before: GameState, step: ReplayStep): number {
  const m = step.move;
  return (m.source === 'center' ? before.center : before.factories[m.source])[m.color];
}

export function analysisScreen(root: HTMLElement, app: App): () => void {
  let alive = true;
  let view: GameView | null = null;
  const t = target;
  if (!t) {
    app.go('home');
    return () => undefined;
  }
  void loadFullGame(t.id).then((full) => {
    if (!alive) return;
    const replay = full ? replayPositions(full.game.state.numPlayers, full.game.config.seed, full.game.config.starter, full.game.moves, full.game.state) : null;
    if (!full || !replay) {
      root.append(h('div', { class: 'screen page' }, h('p', { class: 'pad' }, 'Esta partida no se puede analizar.')));
      setTimeout(() => alive && app.go(t.back), 1500);
      return;
    }
    view = mountAnalysis(root, app, t, full, replay.start, replay.steps, () => alive);
  });
  return () => {
    alive = false;
    view?.destroy();
  };
}

function mountAnalysis(
  root: HTMLElement,
  app: App,
  t: { id: number; back: string },
  full: FullGame,
  start: GameState,
  steps: ReplayStep[],
  isAlive: () => boolean,
): GameView {
  const g = full.game;
  const config = { ...g.config, training: { ...(g.config.training ?? {}), bagCounter: false, challenge: false, noAids: false } } as typeof g.config;
  const noop = () => undefined;
  const view = new GameView(config, {
    onMove: noop, onPredict: noop, onGuess: noop, onSkip: noop, onHint: noop, onUndo: noop,
    onExit: () => app.go(t.back),
    sound: noop,
    haptic: noop,
  });
  view.mount(root);
  view.disableInput();
  const n = steps.length;
  const states = [start, ...steps.map((st) => st.state)];
  const players = steps.map((st) => st.player);
  const names = config.players.map((p) => p.name);
  const records = new Map<number, MoveRecord>(g.records.map((r) => [r.turn, r]));
  const evals: Array<StoredEval | null> = full.moveEvals && full.moveEvals.length === n
    ? full.moveEvals.slice()
    : steps.map((st) => {
      const rec = st.player === HUMAN ? records.get(st.before.turn) : undefined;
      return rec && rec.gap !== undefined ? { loss: rec.loss, gap: rec.gap, best: rec.best } : null;
    });
  let balance = errorBalance(evals, players, HUMAN, g.state.numPlayers);
  let pos = 0;
  let moments: CriticalMoment[] = [];
  const pending = () => evals.filter((e) => !e).length;

  // ---------- barra inferior ----------
  const spark = s('svg', { viewBox: '0 0 300 44', class: 'spark', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Balance de errores tras cada jugada' });
  const counter = h('span', { class: 'rp-count' });
  const evalChip = h('span', { class: 'rp-eval' });
  const btn = (label: string, aria: string, fn: () => void) => {
    const b = h('button', { class: 'cbtn', 'aria-label': aria, title: aria }, label);
    b.addEventListener('click', fn);
    return b;
  };
  const first = btn('⏮', 'Inicio', () => go(0, false));
  const prev = btn('◀', 'Jugada anterior', () => go(pos - 1, false));
  const next = btn('▶', 'Jugada siguiente', () => go(pos + 1, true));
  const last = btn('⏭', 'Final', () => go(n, false));
  view.coachBar.replaceChildren(
    h('div', { class: 'replay' },
      h('div', { class: 'spark-wrap' }, spark),
      h('div', { class: 'rp-row' }, first, prev, h('div', { class: 'rp-mid' }, counter, evalChip), next, last)));
  view.coachBar.classList.add('replay-bar');
  spark.addEventListener('click', (e) => {
    const r = spark.getBoundingClientRect();
    go(Math.round(((e.clientX - r.left) / r.width) * n), false);
  });

  // ---------- panel de información (arriba) ----------
  const info = view.hintPanel;
  info.classList.add('replay-info');

  function drawSpark(): void {
    const W = 300;
    const H = 44;
    const m = Math.max(3, ...balance.map((v) => Math.abs(v)));
    const x = (k: number) => (n ? (k / n) * W : 0);
    const y = (v: number) => H / 2 - (v / m) * (H / 2 - 3);
    const parts: SVGElement[] = [s('line', { x1: 0, x2: W, y1: H / 2, y2: H / 2, class: 'sp-zero' })];
    for (const mo of moments) parts.push(s('rect', { x: x(mo.index) - 3, y: 0, width: 6, height: H, class: `sp-moment ${mo.kind}` }));
    parts.push(s('path', { d: balance.map((v, k) => `${k === 0 ? 'M' : 'L'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' '), class: 'sp-line' }));
    parts.push(s('line', { x1: x(pos), x2: x(pos), y1: 0, y2: H, class: 'sp-cursor' }));
    spark.replaceChildren(...parts);
  }

  function renderInfo(): void {
    const head = h('div', { class: 'hp-head' }, h('strong', {}, pos === 0 ? 'Inicio de la partida' : `Jugada ${pos} de ${n}`));
    const close = h('button', { class: 'icon-btn sm close', 'aria-label': 'Ocultar' }, '×');
    close.addEventListener('click', () => (info.hidden = true));
    head.append(close);
    const body: HTMLElement[] = [];
    if (pos > 0) {
      const st = steps[pos - 1];
      const who = names[st.player];
      body.push(h('p', {}, h('b', {}, `${who}: `), describeMove(st.move, sourceCount(st.before, st))));
      const rec = st.player === HUMAN ? records.get(st.before.turn) : undefined;
      const ev = evals[pos - 1];
      if (ev) {
        const label = rec ? rec.label : labelFor(ev.loss);
        const only = ev.loss <= 0.3 && ev.gap >= 2;
        body.push(h('p', {}, h('span', { class: `chip ${label}` }, `${LABEL_ICON[label]} ${LABEL_TEXT[label]}`),
          ev.loss > 0.05 ? h('span', { class: 'muted small' }, ` pierde ~${fmtAbs(ev.loss)}`) : null,
          only ? h('span', { class: 'muted small' }, ` · jugada única: la siguiente opción perdía ~${fmtAbs(ev.gap)}`) : null));
        const best = rec?.best ?? ev.best;
        if (label !== 'excelente' && best) {
          const bc = (best.source === 'center' ? st.before.center : st.before.factories[best.source])[best.color];
          body.push(h('p', { class: 'small' }, h('b', {}, 'Mejor: '), describeMove(best, bc)));
        }
        if (rec && rec.label !== 'excelente' && rec.reasons.length) body.push(h('ul', { class: 'small' }, ...rec.reasons.map((r) => h('li', {}, r))));
      } else {
        body.push(h('p', { class: 'muted small' }, 'El entrenador aún está valorando esta jugada…'));
      }
    }
    if (moments.length) {
      const chips = moments.map((mo, i) => {
        const b = h('button', { class: `moment ${mo.kind}${mo.index === pos ? ' on' : ''}` }, `${i + 1}. ${momentText(mo, names)}`);
        b.addEventListener('click', () => go(mo.index, false));
        return b;
      });
      body.push(h('div', { class: 'moments' }, h('span', { class: 'muted small' }, 'Momentos críticos:'), ...chips));
    }
    if (pending()) {
      body.push(h('p', { class: 'muted small' }, `El entrenador está valorando las jugadas… faltan ${pending()} de ${n}.`));
    }
    info.replaceChildren(head, ...body);
    info.hidden = false;
  }

  function renderBar(): void {
    counter.textContent = `${pos}/${n}`;
    const v = balance[pos];
    evalChip.textContent = `balance de errores ${fmt(v)}`;
    evalChip.className = `rp-eval ${v > 0.5 ? 'good' : v < -0.5 ? 'bad' : ''}`;
    first.toggleAttribute('disabled', pos === 0);
    prev.toggleAttribute('disabled', pos === 0);
    next.toggleAttribute('disabled', pos === n);
    last.toggleAttribute('disabled', pos === n);
    drawSpark();
  }

  function go(k: number, animate: boolean): void {
    const to = Math.max(0, Math.min(n, k));
    if (to === pos && k !== 0) return;
    pos = to;
    void view.showPosition(states[pos], animate);
    view.markTarget(pos > 0 ? steps[pos - 1].player : 0, pos > 0 ? steps[pos - 1].move.target : null);
    view.setStatus('');
    renderBar();
    renderInfo();
  }

  view.setStatus('');
  void view.showPosition(states[0], false);
  renderBar();
  renderInfo();

  // ---------- valoración de cada jugada por el entrenador ----------
  function refresh(): void {
    balance = errorBalance(evals, players, HUMAN, g.state.numPlayers);
    moments = pending() ? [] : criticalMoments(evals, players, HUMAN);
    renderBar();
    renderInfo();
  }

  async function compute(): Promise<void> {
    const client = services.analysis();
    for (let k = 0; k < n && isAlive(); k++) {
      if (evals[k]) continue;
      const st = steps[k];
      const v = await client.call<Verdict | null>({ type: 'rate', state: st.before, move: st.move, names, budgetMs: RATE_MS }).promise;
      if (!isAlive()) return;
      evals[k] = v ? { loss: v.loss, gap: v.gap ?? 0, best: v.best.move } : { loss: 0, gap: 0 };
      refresh();
    }
    if (isAlive() && !pending()) await saveEvals(t.id, full, evals);
  }
  refresh();
  if (pending()) void compute().catch((e) => console.warn('No se pudo analizar la partida', e));
  return view;
}
