import { kvGet } from '../../storage/db';
import type { App } from '../app';
import { h } from '../dom';
import type { SavedGame } from '../session';
import { logo } from './common';
import { nextTagline, TAGLINES } from '../taglines';

const ROTATE_MS = 5000;

function rotatingTagline(): { el: HTMLParagraphElement; stop: () => void } {
  let idx = nextTagline(-1);
  const el = h('p', { class: 'tagline', 'aria-live': 'off' }, TAGLINES[idx]);
  const timer = window.setInterval(() => {
    if (document.hidden) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    idx = nextTagline(idx);
    if (reduced) {
      el.textContent = TAGLINES[idx];
      return;
    }
    const out = el.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 260, easing: 'ease-in' });
    out.finished.then(() => {
      el.textContent = TAGLINES[idx];
      el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'ease-out' });
    }).catch(() => undefined);
  }, ROTATE_MS);
  return { el, stop: () => window.clearInterval(timer) };
}

export function homeScreen(root: HTMLElement, app: App): () => void {
  const tagline = rotatingTagline();
  const cont = h('button', { class: 'btn', hidden: true }, 'Continuar partida');
  cont.addEventListener('click', () => app.go('game'));
  const btn = (label: string, to: string, primary = false) => {
    const b = h('button', { class: primary ? 'btn primary' : 'btn' }, label);
    b.addEventListener('click', () => app.go(to));
    return b;
  };
  root.append(h('div', { class: 'screen home' },
    logo(),
    tagline.el,
    h('nav', { class: 'menu' },
      btn('Nueva partida', 'setup', true),
      cont,
      btn('Progreso', 'progress'),
      btn('Cómo jugar', 'howto'),
      btn('Ajustes', 'settings')),
    h('footer', { class: 'foot muted' },
      h('p', {}, 'Funciona sin conexión · v', __APP_VERSION__),
      h('p', { class: 'author' }, 'Danuve'))));
  void kvGet<SavedGame>('current').then((g) => {
    if (g && g.state.phase === 'playing') {
      cont.hidden = false;
      cont.textContent = `Continuar partida (ronda ${g.state.round})`;
    }
  });
  return tagline.stop;
}
