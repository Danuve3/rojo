import { clear } from './dom';

export type ScreenFactory = (root: HTMLElement, app: App) => (() => void) | void;

/** Enrutador mínimo entre pantallas. */
export class App {
  private cleanup: (() => void) | null = null;
  private screens = new Map<string, ScreenFactory>();

  constructor(readonly root: HTMLElement) {}

  register(name: string, f: ScreenFactory): void {
    this.screens.set(name, f);
  }

  go(name: string): void {
    const f = this.screens.get(name);
    if (!f) throw new Error(`Pantalla desconocida: ${name}`);
    this.cleanup?.();
    this.cleanup = null;
    clear(this.root);
    window.scrollTo(0, 0);
    const c = f(this.root, this);
    this.cleanup = c ?? null;
  }
}
