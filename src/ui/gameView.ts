import {
  type Bonus, FIRST_TOKEN, type FloorPenalty, floorPenalty, FLOOR_SIZE, type GameState, type Move, type Placement,
  type Source, type Target, type TurnResult, validTargets, sum, rowCount, colCount, colorCount,
} from '../engine';
import { getSettings, onSettings, updateSettings } from '../storage/settings';
import { buildBoard, type BoardView } from './board';
import { boardSvg } from './boardSvg';
import type { GameConfig } from './config';
import { HUMAN } from './config';
import { h, wait } from './dom';
import { computeSizes } from './layout';
import { floorSlot, lineSlot, modelFromState, type SlotModel, zoneOf, wallSlot } from './model';
import { buildTable, type TableView } from './table';
import { COLOR_NAMES_PLURAL } from './tileArt';
import { type Motion, type SlotRect, TileLayer } from './tileLayer';

export type SoundName =
  | 'select' | 'pick' | 'drop' | 'floor' | 'botPick' | 'botDrop' | 'score' | 'combo' | 'penalty' | 'win' | 'lose'
  | 'coachGood' | 'coachWarn' | 'round' | 'deal' | 'cancel';

export interface ViewEvents {
  onMove(m: Move): void;
  onSkip(): void;
  onHint(): void;
  onUndo(): void;
  onExit(): void;
  sound(name: SoundName, opts?: { step?: number; bot?: boolean }): void;
  haptic(pattern: number | number[]): void;
}

export interface HintMark {
  move: Move;
  rank: number;
}

interface Selection {
  source: Source;
  color: number;
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class GameView {
  readonly el: HTMLDivElement;
  private layer: TileLayer;
  private table: TableView;
  private boards: BoardView[] = [];
  private rivalsEl: HTMLDivElement;
  private fx: HTMLDivElement;
  private status: HTMLDivElement;
  private roundLabel: HTMLSpanElement;
  readonly coachBar: HTMLDivElement;
  readonly hintBtn: HTMLButtonElement;
  readonly undoBtn: HTMLButtonElement;
  readonly verdictEl: HTMLDivElement;
  readonly hintPanel: HTMLDivElement;
  private slotEls = new Map<string, HTMLElement>();
  private rectCache = new Map<string, SlotRect>();
  private origin: DOMRect | null = null;
  private ro: ResizeObserver | null = null;
  private state: GameState | null = null;
  private selection: Selection | null = null;
  private inputOn = false;
  private skipping = false;
  private scoreShown: number[] = [];
  private tokenAtCenter = false;
  private pending: Target | null = null;
  private offSettings: () => void = () => undefined;

  constructor(private config: GameConfig, private ev: ViewEvents) {
    const n = config.players.length;
    this.table = buildTable(n * 2 + 1);
    this.layer = new TileLayer({
      resolve: (slot, model) => this.resolve(slot, model),
      bag: () => this.pileRect(this.table.bag),
      box: () => this.pileRect(this.table.box),
      timeScale: () => this.timeScale(),
      motion: (from, to, i) => this.motion(from, to, i),
      onLand: (_t, slot) => this.onLand(slot),
    });
    config.players.forEach((p, i) => {
      const b = buildBoard({
        player: i,
        name: p.name,
        tag: p.kind === 'bot' ? `Nv ${p.level}` : undefined,
        compact: i !== HUMAN,
      });
      this.boards.push(b);
      b.slots.forEach((el, id) => this.slotEls.set(id, el));
    });
    this.table.slots.forEach((el, id) => this.slotEls.set(id, el));
    this.rivalsEl = h('div', { class: `rivals r${n - 1}` }, ...this.boards.filter((_, i) => i !== HUMAN).map((b) => b.el));
    this.roundLabel = h('span', { class: 'round-label' }, 'Ronda 1');
    this.status = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
    this.hintBtn = h('button', { class: 'cbtn hint', 'aria-label': 'Pista', title: 'Pista' }, '💡');
    this.undoBtn = h('button', { class: 'cbtn undo', 'aria-label': 'Deshacer', title: 'Deshacer' }, '↶');
    this.verdictEl = h('div', { class: 'verdict', role: 'status', 'aria-live': 'polite' });
    this.hintPanel = h('div', { class: 'hint-panel', hidden: true });
    this.coachBar = h('div', { class: 'coachbar' }, this.hintBtn, this.status, this.undoBtn);
    this.fx = h('div', { class: 'fx-layer' });
    const mute = h('button', { class: 'icon-btn sm', 'aria-label': 'Silenciar' });
    const paintMute = () => {
      const m = getSettings().muted;
      mute.textContent = m ? '🔇' : '🔊';
      mute.setAttribute('aria-pressed', String(m));
    };
    paintMute();
    this.offSettings = onSettings(paintMute);
    mute.addEventListener('click', () => updateSettings({ muted: !getSettings().muted }));
    const exit = h('button', { class: 'icon-btn', 'aria-label': 'Volver al inicio' }, '‹');
    exit.addEventListener('click', () => ev.onExit());
    const me = h('section', { class: 'me' }, this.boards[HUMAN].el);
    this.el = h('div', { class: 'screen game' },
      h('header', { class: 'g-top' }, exit, this.roundLabel, h('span', { class: 'spacer' }), mute),
      this.rivalsEl,
      h('section', { class: 'table-wrap' }, this.table.el),
      me,
      this.coachBar,
      this.hintPanel,
      this.verdictEl,
      this.layer.root,
      this.fx);
    this.bindInput();
  }

  // ---------- montaje y tamaños ----------

  mount(parent: HTMLElement): void {
    parent.append(this.el);
    this.ro = new ResizeObserver(() => this.relayout());
    this.ro.observe(this.el);
    this.relayout();
  }

  destroy(): void {
    this.offSettings();
    this.ro?.disconnect();
    this.layer.finishAll();
    this.el.remove();
  }

  private relayout(): void {
    const sz = computeSizes(window.innerWidth, window.innerHeight, this.config.players.length - 1);
    this.el.style.setProperty('--cell', `${sz.cell}px`);
    this.el.style.setProperty('--rc', `${sz.rivalCell}px`);
    this.table.layout();
    this.invalidate();
    this.layer.relayout();
  }

  private invalidate(): void {
    this.rectCache.clear();
    this.origin = null;
  }

  private originRect(): DOMRect {
    if (!this.origin) this.origin = this.el.getBoundingClientRect();
    return this.origin;
  }

  private resolve(slot: string, model: SlotModel): SlotRect | null {
    if (slot.startsWith('c:')) {
      let n = 0;
      for (const k of model.keys()) if (k.startsWith('c:')) n++;
      return this.table.centerRect(Number(slot.slice(2)), n, this.originRect());
    }
    const cached = this.rectCache.get(slot);
    if (cached) return cached;
    const el = this.slotEls.get(slot);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const o = this.originRect();
    const size = Math.min(r.width, r.height);
    const rect = { x: r.left - o.left + (r.width - size) / 2, y: r.top - o.top + (r.height - size) / 2, size };
    this.rectCache.set(slot, rect);
    return rect;
  }

  private pileRect(el: HTMLElement): SlotRect {
    const r = el.getBoundingClientRect();
    const o = this.originRect();
    return { x: r.left - o.left + r.width / 2 - 12, y: r.top - o.top + r.height / 2 - 12, size: 24 };
  }

  timeScale(): number {
    if (this.skipping) return 0;
    const sp = getSettings().animSpeed;
    if (sp === 'instant') return 0;
    const base = sp === 'fast' ? 0.5 : 1;
    return reducedMotion() ? Math.min(base, 0.35) : base;
  }

  private motion(from: string | null, to: string, i: number): Motion {
    const zt = zoneOf(to);
    const zf = from ? zoneOf(from) : null;
    const reduced = reducedMotion();
    const arc = (v: number) => (reduced ? 0 : v);
    if (zf === null) return { duration: 460, delay: 40 + i * 32, arc: arc(36), bounce: false };
    if ((zf === 'factory' || zf === 'center') && (zt === 'line' || zt === 'floor'))
      return { duration: 480, delay: i * 85, arc: arc(46), bounce: zt === 'floor' && !reduced };
    if (zf === 'factory' && zt === 'center') return { duration: 360, delay: 140 + i * 30, arc: 0, bounce: false };
    if (zf === 'center' && zt === 'center') return { duration: 240, delay: 60, arc: 0, bounce: false };
    if (zf === 'line' && zt === 'wall') return { duration: 380, delay: 0, arc: arc(14), bounce: false };
    return { duration: 300, delay: 0, arc: 0, bounce: false };
  }

  private landingBot = false;
  private onLand(slot: string): void {
    const z = zoneOf(slot);
    if (z === 'line') this.ev.sound(this.landingBot ? 'botDrop' : 'drop');
    else if (z === 'floor') this.ev.sound('floor', { bot: this.landingBot });
  }

  // ---------- render ----------

  private viewModel(s: GameState): SlotModel {
    const m = modelFromState(s);
    if (this.tokenAtCenter && !s.centerHasFirst) m.set('c:0', FIRST_TOKEN);
    return m;
  }

  private updateChrome(s: GameState): void {
    this.roundLabel.textContent = s.phase === 'over' ? 'Fin de la partida' : `Ronda ${s.round}`;
    this.table.bagCount.textContent = String(sum(s.bag));
    this.table.boxCount.textContent = String(sum(s.box));
    this.boards.forEach((b, i) => b.setActive(s.phase === 'playing' && s.current === i));
  }

  sync(s: GameState): void {
    this.state = s;
    this.tokenAtCenter = false;
    this.layer.sync(this.viewModel(s));
    this.scoreShown = s.players.map((p) => p.score);
    this.boards.forEach((b, i) => b.setScore(s.players[i].score));
    this.updateChrome(s);
  }

  setStatus(text: string, thinking = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('thinking', thinking);
  }

  /** Muestra brevemente qué va a coger un bot antes de animar la jugada. */
  async previewBotMove(s: GameState, m: Move): Promise<void> {
    const tiles = this.sourceTiles(m.source, m.color);
    tiles.forEach((sl) => this.layer.tileAt(sl)?.inner.classList.add('lifted'));
    this.ev.sound('botPick');
    const target = m.target === 'floor' ? this.boards[s.current].floor : this.boards[s.current].lines[m.target];
    target.classList.add('bot-target');
    await wait(260 * this.timeScale());
    target.classList.remove('bot-target');
  }

  async showTurn(s: GameState, r: TurnResult): Promise<void> {
    this.state = s;
    this.clearSelection();
    this.clearHints();
    this.landingBot = r.player !== HUMAN;
    for (const t of this.layer.tiles()) t.inner.classList.remove('lifted');
    if (r.player === HUMAN) this.ev.haptic(12);
    this.updateChrome(s);
    await this.layer.transition(this.viewModel(s));
    this.landingBot = false;
  }

  /** Alicatado de una fila (todos los jugadores a la vez). */
  async showPlacements(s: GameState, placements: Placement[]): Promise<void> {
    await this.layer.transition(this.viewModel(s));
    const ts = this.timeScale();
    const jobs = placements.map(async (pl) => {
      const mine = pl.player === HUMAN;
      const cells = [...pl.cells].sort((a, b) => Math.abs(a - (pl.row * 5 + pl.col)) - Math.abs(b - (pl.row * 5 + pl.col)));
      for (let i = 0; i < cells.length; i++) {
        const slot = wallSlot(pl.player, Math.floor(cells[i] / 5), cells[i] % 5);
        void this.layer.pulse(slot, [
          { filter: 'brightness(1)', transform: 'scale(1)' },
          { filter: 'brightness(1.6)', transform: 'scale(1.18)' },
          { filter: 'brightness(1)', transform: 'scale(1)' },
        ], 280);
        if (mine) this.ev.sound('score', { step: i });
        await wait(110 * ts);
      }
      this.popupAt(wallSlot(pl.player, pl.row, pl.col), `+${pl.points}`, 'plus');
      this.animateScore(pl.player, pl.scoreAfter);
      this.checkMilestones(s, pl);
    });
    if (!placements.some((p) => p.player === HUMAN)) this.ev.sound('score', { step: 0, bot: true });
    await Promise.all(jobs);
    await wait(160 * ts);
  }

  /** Celebración al completar una fila, una columna o un color. */
  private checkMilestones(s: GameState, pl: Placement): void {
    const wall = s.players[pl.player].wall;
    const done: string[] = [];
    if (rowCount(wall, pl.row) === 5) done.push('¡Fila completa!');
    if (colCount(wall, pl.col) === 5) done.push('¡Columna completa!');
    if (colorCount(wall, pl.color) === 5) done.push(`¡Todos los ${COLOR_NAMES_PLURAL[pl.color]}!`);
    if (!done.length) return;
    const mine = pl.player === HUMAN;
    this.celebrate(this.boards[pl.player].el, mine ? 30 : 12);
    if (mine) {
      this.ev.sound('combo');
      this.ev.haptic([15, 30, 15]);
      this.banner(done.join(' '));
    }
  }

  async showPenalties(s: GameState, pens: FloorPenalty[]): Promise<void> {
    const ts = this.timeScale();
    const hits = pens.filter((p) => p.penalty > 0);
    if (hits.length) {
      this.ev.sound('penalty');
      if (hits.some((p) => p.player === HUMAN)) this.ev.haptic([20, 40, 20]);
      for (const p of hits) {
        const floor = this.boards[p.player].floor;
        if (ts > 0) floor.animate([
          { transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
          { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' },
        ], { duration: 360 * ts });
        this.popupEl(floor, `-${p.penalty}`, 'minus');
        this.animateScore(p.player, p.scoreAfter);
      }
      await wait(420 * ts);
    }
    this.tokenAtCenter = true;
    await this.layer.transition(this.viewModel(s));
  }

  async showRoundStart(s: GameState): Promise<void> {
    this.tokenAtCenter = false;
    this.updateChrome(s);
    const ts = this.timeScale();
    this.banner(`Ronda ${s.round}`);
    this.ev.sound('round');
    await wait(300 * ts);
    this.ev.sound('deal');
    await this.layer.transition(this.viewModel(s));
  }

  async showBonuses(s: GameState, bonuses: Bonus[]): Promise<void> {
    this.updateChrome(s);
    const ts = this.timeScale();
    for (const b of bonuses) {
      if (b.points <= 0) continue;
      const parts = [b.rows ? `${b.rows}× fila` : '', b.cols ? `${b.cols}× columna` : '', b.colors ? `${b.colors}× color` : '']
        .filter(Boolean).join(' · ');
      this.popupEl(this.boards[b.player].el, `+${b.points} (${parts})`, 'plus big');
      this.animateScore(b.player, b.scoreAfter);
      if (b.player === HUMAN) this.ev.sound('combo');
      await wait(500 * ts);
    }
    this.boards.forEach((bd, i) => bd.setScore(s.players[i].score));
  }

  // ---------- efectos ----------

  private animateScore(player: number, to: number): void {
    const from = this.scoreShown[player] ?? 0;
    this.scoreShown[player] = to;
    const el = this.boards[player].score;
    const ts = this.timeScale();
    if (ts <= 0 || from === to) {
      el.textContent = String(to);
      return;
    }
    const dur = 450 * ts;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 380 * ts });
  }

  private popupAt(slot: string, text: string, cls: string): void {
    const r = this.resolve(slot, this.layer.current);
    if (r) this.popup(text, r.x + r.size / 2, r.y, cls);
  }

  private popupEl(el: HTMLElement, text: string, cls: string): void {
    const r = el.getBoundingClientRect();
    const o = this.originRect();
    this.popup(text, r.left - o.left + r.width / 2, r.top - o.top + r.height / 3, cls);
  }

  popup(text: string, x: number, y: number, cls: string): void {
    const ts = this.timeScale();
    const el = h('div', { class: `popup ${cls}` }, text);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.fx.append(el);
    const a = el.animate([
      { transform: 'translate(-50%, 0) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%, -14px) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -34px) scale(1)', opacity: 0 },
    ], { duration: Math.max(500, 1100 * ts), easing: 'ease-out' });
    a.finished.finally(() => el.remove());
  }

  banner(text: string): void {
    const ts = this.timeScale();
    if (ts <= 0) return;
    const el = h('div', { class: 'banner' }, text);
    this.fx.append(el);
    const a = el.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.8)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.2 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.75 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.05)' },
    ], { duration: 1100 * ts, easing: 'ease-out' });
    a.finished.finally(() => el.remove());
  }

  /** Celebración: esquirlas de azulejo desde un elemento. */
  celebrate(target: HTMLElement | null, count = 26): void {
    const ts = this.timeScale();
    if (ts <= 0) return;
    const o = this.originRect();
    const r = (target ?? this.el).getBoundingClientRect();
    const cx = r.left - o.left + r.width / 2;
    const cy = r.top - o.top + r.height / 2;
    const colors = ['#2a5db0', '#e3a93a', '#c8402e', '#33343d', '#f3ead7'];
    for (let i = 0; i < count; i++) {
      const el = h('div', { class: 'shard' });
      el.style.background = colors[i % 5];
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      this.fx.append(el);
      const ang = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 110;
      const dx = Math.cos(ang) * d;
      const dy = Math.sin(ang) * d - 40;
      const rot = (Math.random() - 0.5) * 720;
      const a = el.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 90}px) rotate(${rot}deg) scale(.6)`, opacity: 0 },
      ], { duration: (900 + Math.random() * 500) * Math.max(ts, 0.6), easing: 'cubic-bezier(.2,.6,.4,1)' });
      a.finished.finally(() => el.remove());
    }
  }

  boardEl(player: number): HTMLElement {
    return this.boards[player].el;
  }

  // ---------- entrada ----------

  enableInput(s: GameState): void {
    this.state = s;
    this.inputOn = true;
    this.layer.root.classList.add('interactive');
    this.boards[HUMAN].el.classList.add('my-turn');
  }

  disableInput(): void {
    this.inputOn = false;
    this.clearSelection();
    this.layer.root.classList.remove('interactive');
    this.boards[HUMAN].el.classList.remove('my-turn');
  }

  setSkipping(on: boolean): void {
    this.skipping = on;
    if (on) this.layer.finishAll();
  }

  private bindInput(): void {
    this.layer.root.addEventListener('click', (e) => {
      const tileEl = (e.target as HTMLElement).closest<HTMLElement>('.tile');
      if (!tileEl) return;
      e.stopPropagation();
      this.onTileTap(tileEl.dataset.slot ?? '', Number(tileEl.dataset.color));
    });
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (this.layer.busy) {
        this.ev.onSkip();
        this.layer.finishAll();
      }
      if (t.closest('button, .hint-panel, .verdict')) return;
      const rival = t.closest<HTMLElement>('.board.compact');
      if (rival && !this.selection) {
        this.expandRival(Number(rival.dataset.player));
        return;
      }
      const targetEl = t.closest<HTMLElement>('.board:not(.compact) [data-target]');
      if (targetEl && this.selection) {
        const raw = targetEl.dataset.target ?? '';
        this.onTargetTap(raw === 'floor' ? 'floor' : (Number(raw) as Target));
        return;
      }
      if (this.selection) {
        this.clearSelection();
        this.ev.sound('cancel');
      }
    });
  }

  private sourceOf(slot: string): Source | null {
    if (slot.startsWith('f:')) return Number(slot.split(':')[1]);
    if (slot.startsWith('c:')) return 'center';
    return null;
  }

  private sourceTiles(source: Source, color: number): string[] {
    const out: string[] = [];
    for (const [slot, c] of this.layer.current) {
      if (c !== color) continue;
      if (source === 'center' ? slot.startsWith('c:') : slot.startsWith(`f:${source}:`)) out.push(slot);
    }
    return out;
  }

  private onTileTap(slot: string, color: number): void {
    if (!this.inputOn || !this.state) return;
    const source = this.sourceOf(slot);
    if (source === null || color === FIRST_TOKEN) return;
    if (this.selection && this.selection.source === source && this.selection.color === color) {
      this.clearSelection();
      this.ev.sound('cancel');
      return;
    }
    this.select({ source, color });
  }

  private select(sel: Selection): void {
    const s = this.state;
    if (!s) return;
    this.clearSelection();
    this.selection = sel;
    this.ev.sound('pick');
    this.ev.haptic(8);
    for (const sl of this.sourceTiles(sel.source, sel.color)) this.layer.tileAt(sl)?.inner.classList.add('lifted');
    for (const t of this.layer.tiles()) {
      if (t.slot && (t.slot.startsWith('f:') || t.slot.startsWith('c:')) && !t.inner.classList.contains('lifted')) t.inner.classList.add('dim');
    }
    this.showTargets(s, sel);
  }

  private floorCost(s: GameState, sel: Selection, target: Target): { put: number; over: number; slots: number; pen: number } {
    const p = s.players[HUMAN];
    const count = sel.source === 'center' ? s.center[sel.color] : s.factories[sel.source][sel.color];
    const token = sel.source === 'center' && s.centerHasFirst ? 1 : 0;
    const put = target === 'floor' ? 0 : Math.min(target + 1 - p.lineCount[target], count);
    const over = count - put;
    const before = p.floor.length;
    const after = Math.min(FLOOR_SIZE, before + token + over);
    return { put, over, slots: after - before, pen: floorPenalty(after) - floorPenalty(before) };
  }

  private showTargets(s: GameState, sel: Selection): void {
    const p = s.players[HUMAN];
    const valid = new Set(validTargets(p, sel.color));
    const board = this.boards[HUMAN];
    board.el.classList.add('choosing');
    board.lines.forEach((line, row) => {
      const ok = valid.has(row as Target);
      line.classList.toggle('valid', ok);
      line.classList.toggle('invalid', !ok);
      const badge = board.badges[row];
      badge.textContent = '';
      badge.classList.remove('warn');
      if (!ok) return;
      const c = this.floorCost(s, sel, row as Target);
      line.classList.toggle('spill', c.slots > 0);
      if (c.over > 0) {
        badge.textContent = `⬇${c.over}`;
        badge.classList.add('warn');
      } else if (p.lineCount[row] + c.put === row + 1) badge.textContent = '✓';
    });
    board.floor.classList.add('valid');
    const count = sel.source === 'center' ? s.center[sel.color] : s.factories[sel.source][sel.color];
    this.setStatus(`${count} ${COLOR_NAMES_PLURAL[sel.color]}: elige línea o suelo`);
  }

  private clearPreview(): void {
    this.pending = null;
    const board = this.boards[HUMAN];
    board.el.querySelectorAll('.will, .will-pen').forEach((e) => e.classList.remove('will', 'will-pen'));
    board.lines.forEach((l) => l.classList.remove('pending'));
    board.floor.classList.remove('pending');
    board.floorBadge.textContent = '';
  }

  /** Vista previa: marca los huecos que se llenarían y la penalización del suelo. */
  private showPreview(s: GameState, sel: Selection, target: Target): void {
    this.clearPreview();
    this.pending = target;
    const p = s.players[HUMAN];
    const board = this.boards[HUMAN];
    const c = this.floorCost(s, sel, target);
    if (target !== 'floor') {
      board.lines[target].classList.add('pending');
      for (let k = p.lineCount[target]; k < p.lineCount[target] + c.put; k++) {
        board.slots.get(lineSlot(HUMAN, target, k))?.classList.add('will');
      }
    } else board.floor.classList.add('pending');
    for (let k = p.floor.length; k < p.floor.length + c.slots; k++) board.slots.get(floorSlot(HUMAN, k))?.classList.add('will-pen');
    board.floorBadge.textContent = `−${c.pen}`;
    this.setStatus(`${c.slots} al suelo (−${c.pen}). Toca otra vez para confirmar`);
    this.ev.sound('select');
  }

  private clearSelection(): void {
    this.clearPreview();
    this.selection = null;
    for (const t of this.layer.tiles()) t.inner.classList.remove('lifted', 'dim');
    const board = this.boards[HUMAN];
    board.el.classList.remove('choosing');
    board.lines.forEach((l, i) => {
      l.classList.remove('valid', 'invalid', 'spill');
      board.badges[i].textContent = '';
    });
    board.floor.classList.remove('valid');
  }

  private onTargetTap(target: Target): void {
    const s = this.state;
    const sel = this.selection;
    if (!s || !sel || !this.inputOn) return;
    if (target !== 'floor' && !validTargets(s.players[HUMAN], sel.color).includes(target)) {
      this.ev.sound('cancel');
      return;
    }
    const cost = this.floorCost(s, sel, target);
    if (cost.slots > 0 && this.pending !== target) {
      this.showPreview(s, sel, target);
      return;
    }
    const move: Move = { source: sel.source, color: sel.color as Move['color'], target };
    this.disableInput();
    this.ev.onMove(move);
  }

  // ---------- pistas ----------

  showHintMarks(marks: HintMark[]): void {
    this.clearHints();
    for (const mk of marks) {
      for (const sl of this.sourceTiles(mk.move.source, mk.move.color)) {
        this.layer.tileAt(sl)?.inner.classList.add('hinted', `h${mk.rank}`);
      }
      const b = this.boards[HUMAN];
      const target = mk.move.target === 'floor' ? b.floor : b.lines[mk.move.target];
      target.classList.add('hinted', `h${mk.rank}`);
      target.dataset.hint = String(mk.rank);
    }
  }

  clearHints(): void {
    for (const t of this.layer.tiles()) t.inner.classList.remove('hinted', 'h1', 'h2', 'h3');
    const b = this.boards[HUMAN];
    [...b.lines, b.floor].forEach((el) => {
      el.classList.remove('hinted', 'h1', 'h2', 'h3');
      delete el.dataset.hint;
    });
    this.hintPanel.hidden = true;
  }

  // ---------- rivales ----------

  private expandRival(player: number): void {
    const s = this.state;
    if (!s) return;
    const cfg = this.config.players[player];
    const close = () => sheet.remove();
    const sheet = h('div', { class: 'sheet-backdrop', onclick: close },
      h('div', { class: 'sheet' },
        h('h3', {}, `${cfg.name} · nivel ${cfg.level}`),
        boardSvg(s.players[player], { width: 340 }),
        h('p', { class: 'muted' }, 'Toca para cerrar')));
    this.el.append(sheet);
  }
}
