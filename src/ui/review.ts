import { h } from './dom';
import type { SavedGame } from './session';

/** Revisión de la partida (se completa en la fase 7). */
export function reviewSection(g: SavedGame): HTMLElement {
  return h('section', { class: 'card' }, h('h2', {}, 'Revisión'), h('p', { class: 'muted' }, `${g.records.length} jugadas analizadas.`));
}
