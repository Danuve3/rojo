import type { App } from '../app';
import { h } from '../dom';
import { screen } from './common';

export function progressScreen(root: HTMLElement, app: App): void {
  root.append(screen('Progreso', app, h('p', { class: 'muted' }, 'Aún no hay partidas.')));
}
