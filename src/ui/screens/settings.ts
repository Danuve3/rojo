import { clearAll } from '../../storage/db';
import { getSettings, updateSettings, type AnimSpeed, type BotSpeed } from '../../storage/settings';
import type { App } from '../app';
import { h } from '../dom';
import { screen, segmented, toggle } from './common';

export function settingsScreen(root: HTMLElement, app: App): void {
  const st = getSettings();
  const vol = h('input', { type: 'range', min: 0, max: 100, value: Math.round(st.volume * 100), 'aria-label': 'Volumen' });
  vol.addEventListener('input', () => updateSettings({ volume: Number(vol.value) / 100 }));
  const wipe = h('button', { class: 'btn danger' }, 'Borrar todos los datos');
  wipe.addEventListener('click', async () => {
    if (!confirm('¿Borrar la partida en curso, el historial y los ajustes?')) return;
    await clearAll();
    location.reload();
  });
  root.append(screen('Ajustes', app,
    h('section', { class: 'card' }, h('h2', {}, 'Sonido'),
      toggle('Silencio', st.muted, (v) => updateSettings({ muted: v })),
      h('label', { class: 'field' }, h('span', {}, 'Volumen'), vol),
      toggle('Música ambiente', st.music, (v) => updateSettings({ music: v })),
      toggle('Vibración', st.haptics, (v) => updateSettings({ haptics: v }))),
    h('section', { class: 'card' }, h('h2', {}, 'Ritmo'),
      h('div', { class: 'field' }, h('span', {}, 'Animaciones'),
        segmented<AnimSpeed>([{ value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Rápidas' }, { value: 'instant', label: 'Instantáneas' }],
          st.animSpeed, (v) => updateSettings({ animSpeed: v }), 'Velocidad de animación')),
      h('div', { class: 'field' }, h('span', {}, 'Velocidad de los bots'),
        segmented<BotSpeed>([{ value: 'slow', label: 'Pausada' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Rápida' }],
          st.botSpeed, (v) => updateSettings({ botSpeed: v }), 'Velocidad de los bots'))),
    h('section', { class: 'card' }, h('h2', {}, 'Datos'),
      h('p', { class: 'muted small' }, 'Todo se guarda solo en este dispositivo.'), wipe)));
}
