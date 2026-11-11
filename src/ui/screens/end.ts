import { winners } from '../../engine';
import { kvGet } from '../../storage/db';
import type { App } from '../app';
import { HUMAN } from '../config';
import { h } from '../dom';
import type { SavedGame } from '../session';
import { screen } from './common';
import { reviewSection } from '../review';

export function endScreen(root: HTMLElement, app: App): void {
  void kvGet<SavedGame>('lastFinished').then((g) => {
    if (!g) {
      app.go('home');
      return;
    }
    const w = winners(g.state);
    const won = w.includes(HUMAN);
    const order = g.state.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);
    const again = h('button', { class: 'btn primary' }, 'Otra partida');
    again.addEventListener('click', () => app.go('setup'));
    const home = h('button', { class: 'btn' }, 'Inicio');
    home.addEventListener('click', () => app.go('home'));
    root.append(screen(won ? '¡Victoria!' : 'Fin de la partida', app,
      h('section', { class: `card result ${won ? 'won' : 'lost'}` },
        h('ol', { class: 'standings' }, ...order.map(({ p, i }) => {
          const cfg = g.config.players[i];
          return h('li', { class: w.includes(i) ? 'winner' : '' },
            h('span', {}, cfg.name, cfg.kind === 'bot' ? h('small', {}, ` nv ${cfg.level}`) : null),
            h('b', {}, `${p.score}`));
        }))),
      g.config.coach.enabled && g.config.coach.review ? reviewSection(g) : null,
      h('div', { class: 'row-btns' }, home, again)));
  });
}
