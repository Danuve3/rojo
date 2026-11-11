import { kvGet, kvSet } from '../../storage/db';
import type { App } from '../app';
import { h } from '../dom';
import { GameController } from '../gameController';
import type { SavedGame } from '../session';
import { services } from '../services';

export function gameScreen(root: HTMLElement, app: App): () => void {
  let ctrl: GameController | null = null;
  let alive = true;
  void kvGet<SavedGame>('current').then((game) => {
    if (!alive) return;
    if (!game || game.state.phase !== 'playing') {
      root.append(h('p', { class: 'muted pad' }, 'No hay partida en curso.'));
      app.go('home');
      return;
    }
    ctrl = new GameController(game, {
      bots: services.bots(),
      coach: game.config.coach.enabled ? services.coach() : null,
      sound: (n, o) => services.sound(n, o),
      haptic: (p) => services.haptic(p),
      onExit: () => app.go('home'),
      onFinished: (g) => {
        void kvSet('lastFinished', g).then(() => setTimeout(() => alive && app.go('end'), 1600));
      },
    });
    ctrl.mount(root);
  });
  return () => {
    alive = false;
    ctrl?.destroy();
  };
}
