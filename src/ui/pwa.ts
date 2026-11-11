import { registerSW } from 'virtual:pwa-register';
import { h } from './dom';

function toast(text: string, action?: { label: string; run: () => void }, ms = 0): void {
  document.querySelector('.update-toast')?.remove();
  const close = () => el.remove();
  const btn = action ? h('button', { class: 'btn primary' }, action.label) : null;
  btn?.addEventListener('click', action!.run);
  const dismiss = h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar', style: 'color:#fff' }, '×');
  dismiss.addEventListener('click', close);
  const el = h('div', { class: 'update-toast', role: 'status' }, h('span', {}, text), btn, dismiss);
  document.body.append(el);
  if (ms) setTimeout(close, ms);
}

/** Registra el service worker y avisa de nuevas versiones. */
export function setupPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  const update = registerSW({
    onNeedRefresh() {
      toast('Nueva versión disponible', { label: 'Recargar', run: () => void update(true) });
    },
    onOfflineReady() {
      toast('Listo para jugar sin conexión', undefined, 3500);
    },
  });
}
