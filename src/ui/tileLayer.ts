import { h, s } from './dom';
import { type SlotModel, zoneOf } from './model';
import { tileHref } from './tileArt';

export interface SlotRect {
  x: number;
  y: number;
  size: number;
}

export interface Tile {
  el: HTMLDivElement;
  inner: HTMLDivElement;
  use: SVGUseElement;
  color: number;
  slot: string | null;
  rect: SlotRect;
}

export interface Motion {
  duration: number;
  delay: number;
  arc: number;
  bounce: boolean;
}

export interface LayerHooks {
  resolve(slot: string, model: SlotModel): SlotRect | null;
  bag(): SlotRect;
  box(): SlotRect;
  /** Escala de tiempo (0 = instantáneo). */
  timeScale(): number;
  motion(fromSlot: string | null, toSlot: string, index: number): Motion;
  onLand?(tile: Tile, toSlot: string): void;
}

const BASE = 64;

function transformOf(r: SlotRect, scaleMul = 1, dy = 0): string {
  return `translate3d(${r.x}px, ${r.y + dy}px, 0) scale(${(r.size / BASE) * scaleMul})`;
}

function dist2(a: SlotRect, b: SlotRect): number {
  const dx = a.x + a.size / 2 - (b.x + b.size / 2);
  const dy = a.y + a.size / 2 - (b.y + b.size / 2);
  return dx * dx + dy * dy;
}

interface Plan {
  moves: Array<{ tile: Tile; to: string; from: string | null }>;
  spawns: Array<{ color: number; to: string }>;
  removes: Tile[];
}

/**
 * Capa de losetas: un único conjunto de nodos reutilizables posicionados con transform.
 * Las transiciones emparejan losetas por color entre el modelo actual y el nuevo (FLIP).
 */
export class TileLayer {
  readonly root: HTMLDivElement;
  private bySlot = new Map<string, Tile>();
  private pool: Tile[] = [];
  private running = new Set<Animation>();
  private model: SlotModel = new Map();

  constructor(private hooks: LayerHooks) {
    this.root = h('div', { class: 'tile-layer' });
  }

  get current(): SlotModel {
    return this.model;
  }

  tileAt(slot: string): Tile | undefined {
    return this.bySlot.get(slot);
  }

  tiles(): Tile[] {
    return [...this.bySlot.values()];
  }

  private create(color: number): Tile {
    const reused = this.pool.pop();
    const t =
      reused ??
      (() => {
        const use = s('use', { href: tileHref(color) });
        const inner = h('div', { class: 'tile-inner' }, s('svg', { viewBox: '0 0 100 100' }, use));
        const el = h('div', { class: 'tile' }, inner);
        return { el, inner, use, color, slot: null, rect: { x: 0, y: 0, size: BASE } } as Tile;
      })();
    t.color = color;
    t.use.setAttribute('href', tileHref(color));
    t.el.dataset.color = String(color);
    t.el.style.opacity = '';
    t.inner.className = 'tile-inner';
    this.root.append(t.el);
    return t;
  }

  private release(t: Tile): void {
    t.el.remove();
    t.slot = null;
    this.pool.push(t);
  }

  private setSlot(t: Tile, slot: string): void {
    t.slot = slot;
    t.el.dataset.slot = slot;
    t.el.dataset.zone = zoneOf(slot);
  }

  private place(t: Tile, r: SlotRect): void {
    t.rect = r;
    t.el.style.transform = transformOf(r);
  }

  private plan(next: SlotModel): Plan {
    const keep = new Set<string>();
    for (const [slot, color] of next) {
      const t = this.bySlot.get(slot);
      if (t && t.color === color) keep.add(slot);
    }
    const freed = new Map<number, Tile[]>();
    for (const [slot, t] of this.bySlot) {
      if (keep.has(slot)) continue;
      const list = freed.get(t.color) ?? [];
      list.push(t);
      freed.set(t.color, list);
    }
    const plan: Plan = { moves: [], spawns: [], removes: [] };
    const needed: Array<{ slot: string; color: number }> = [];
    for (const [slot, color] of next) if (!keep.has(slot)) needed.push({ slot, color });
    for (const n of needed) {
      const cands = freed.get(n.color);
      const target = this.hooks.resolve(n.slot, next);
      if (!cands || cands.length === 0 || !target) {
        plan.spawns.push({ color: n.color, to: n.slot });
        continue;
      }
      let best = 0;
      for (let i = 1; i < cands.length; i++) if (dist2(cands[i].rect, target) < dist2(cands[best].rect, target)) best = i;
      const [tile] = cands.splice(best, 1);
      plan.moves.push({ tile, to: n.slot, from: tile.slot });
    }
    for (const list of freed.values()) plan.removes.push(...list);
    return plan;
  }

  /** Coloca todo al instante (sin animaciones). */
  sync(next: SlotModel): void {
    this.finishAll();
    const p = this.plan(next);
    const nextBySlot = new Map<string, Tile>();
    for (const [slot, t] of this.bySlot) if (next.get(slot) === t.color && !p.removes.includes(t) && !p.moves.some((m) => m.tile === t)) nextBySlot.set(slot, t);
    for (const t of p.removes) this.release(t);
    for (const m of p.moves) nextBySlot.set(m.to, m.tile);
    for (const sp of p.spawns) nextBySlot.set(sp.to, this.create(sp.color));
    this.bySlot = nextBySlot;
    this.model = new Map(next);
    this.relayout();
  }

  /** Recoloca cada loseta en su slot (tras un cambio de tamaño). */
  relayout(): void {
    for (const [slot, t] of this.bySlot) {
      this.setSlot(t, slot);
      const r = this.hooks.resolve(slot, this.model);
      if (r) this.place(t, r);
    }
  }

  /** Transición animada hacia un nuevo modelo. */
  async transition(next: SlotModel): Promise<void> {
    this.finishAll();
    const p = this.plan(next);
    const nextBySlot = new Map<string, Tile>();
    const moved = new Set(p.moves.map((m) => m.tile));
    for (const [slot, t] of this.bySlot) if (!moved.has(t) && !p.removes.includes(t)) nextBySlot.set(slot, t);
    const jobs: Promise<void>[] = [];
    const counters = new Map<string, number>();
    const indexFor = (key: string) => {
      const n = counters.get(key) ?? 0;
      counters.set(key, n + 1);
      return n;
    };
    for (const m of p.moves) {
      nextBySlot.set(m.to, m.tile);
      const r = this.hooks.resolve(m.to, next);
      if (!r) continue;
      const idx = indexFor(`${m.from?.split(':')[0]}>${zoneOf(m.to)}`);
      jobs.push(this.fly(m.tile, r, this.hooks.motion(m.from, m.to, idx), m.to));
    }
    const bag = this.hooks.bag();
    p.spawns.forEach((sp, i) => {
      const t = this.create(sp.color);
      nextBySlot.set(sp.to, t);
      this.place(t, bag);
      const r = this.hooks.resolve(sp.to, next);
      if (r) jobs.push(this.fly(t, r, this.hooks.motion(null, sp.to, i), sp.to));
    });
    const box = this.hooks.box();
    p.removes.forEach((t, i) => jobs.push(this.vanish(t, box, i)));
    this.bySlot = nextBySlot;
    this.model = new Map(next);
    for (const [slot, t] of this.bySlot) this.setSlot(t, slot);
    await Promise.all(jobs);
  }

  private track(a: Animation): Promise<void> {
    this.running.add(a);
    return a.finished.then(
      () => void this.running.delete(a),
      () => void this.running.delete(a),
    );
  }

  private fly(t: Tile, to: SlotRect, m: Motion, slot: string): Promise<void> {
    const from = t.rect;
    const scale = this.hooks.timeScale();
    this.place(t, to);
    if (scale <= 0 || m.duration <= 0) {
      this.hooks.onLand?.(t, slot);
      return Promise.resolve();
    }
    const frames: Keyframe[] = [{ transform: transformOf(from), offset: 0 }];
    if (m.arc > 0) {
      const mid: SlotRect = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, size: (from.size + to.size) / 2 };
      frames.push({ transform: transformOf(mid, 1.18, -m.arc), offset: 0.5 });
    }
    if (m.bounce) {
      frames.push({ transform: transformOf(to), offset: 0.78 });
      frames.push({ transform: transformOf(to, 1, -to.size * 0.22), offset: 0.89 });
    }
    frames.push({ transform: transformOf(to), offset: 1 });
    t.el.classList.add('flying');
    const a = t.el.animate(frames, {
      duration: m.duration * scale,
      delay: m.delay * scale,
      easing: m.arc > 0 ? 'cubic-bezier(.33,.0,.25,1)' : 'cubic-bezier(.2,.7,.2,1)',
      fill: 'backwards',
    });
    return this.track(a).then(() => {
      t.el.classList.remove('flying');
      this.hooks.onLand?.(t, slot);
    });
  }

  private vanish(t: Tile, box: SlotRect, i: number): Promise<void> {
    const scale = this.hooks.timeScale();
    const from = t.rect;
    if (scale <= 0) {
      this.release(t);
      return Promise.resolve();
    }
    const to: SlotRect = { x: box.x, y: box.y, size: from.size * 0.6 };
    t.el.classList.add('flying');
    const a = t.el.animate(
      [
        { transform: transformOf(from), opacity: 1 },
        { transform: transformOf(to), opacity: 0 },
      ],
      { duration: 420 * scale, delay: (120 + i * 25) * scale, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' },
    );
    return this.track(a).then(() => {
      t.el.classList.remove('flying');
      a.cancel();
      this.release(t);
    });
  }

  /** Completa al instante cualquier animación en curso. */
  finishAll(): void {
    for (const a of [...this.running]) {
      try {
        a.finish();
      } catch {
        a.cancel();
      }
    }
    this.running.clear();
  }

  get busy(): boolean {
    return this.running.size > 0;
  }

  /** Efecto en el contenido de una loseta (no altera su posición). */
  pulse(slot: string, keyframes: Keyframe[], duration: number, delay = 0): Promise<void> {
    const t = this.bySlot.get(slot);
    const scale = this.hooks.timeScale();
    if (!t || scale <= 0) return Promise.resolve();
    return this.track(t.inner.animate(keyframes, { duration: duration * scale, delay: delay * scale, easing: 'ease-out' }));
  }
}
