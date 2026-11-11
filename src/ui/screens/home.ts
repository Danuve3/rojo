import { kvGet } from '../../storage/db';
import type { App } from '../app';
import { h } from '../dom';
import type { SavedGame } from '../session';
import { logo } from './common';

export function homeScreen(root: HTMLElement, app: App): void {
  const cont = h('button', { class: 'btn', hidden: true }, 'Continuar partida');
  cont.addEventListener('click', () => app.go('game'));
  const btn = (label: string, to: string, primary = false) => {
    const b = h('button', { class: primary ? 'btn primary' : 'btn' }, label);
    b.addEventListener('click', () => app.go(to));
    return b;
  };
  root.append(h('div', { class: 'screen home' },
    logo(),
    h('p', { class: 'tagline' }, 'Azulejos, cálculo y un poco de picardía'),
    h('nav', { class: 'menu' },
      btn('Nueva partida', 'setup', true),
      cont,
      btn('Progreso', 'progress'),
      btn('Cómo jugar', 'howto'),
      btn('Ajustes', 'settings')),
    h('p', { class: 'foot muted' }, 'Funciona sin conexión · v', __APP_VERSION__)));
  void kvGet<SavedGame>('current').then((g) => {
    if (g && g.state.phase === 'playing') {
      cont.hidden = false;
      cont.textContent = `Continuar partida (ronda ${g.state.round})`;
    }
  });
}
