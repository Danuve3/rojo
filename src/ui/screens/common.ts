import { h } from '../dom';
import type { App } from '../app';
import { tileSvg } from '../tileArt';

export function screen(title: string, app: App, ...children: Array<Node | null>): HTMLDivElement {
  const back = h('button', { class: 'icon-btn', 'aria-label': 'Volver' }, '‹');
  back.addEventListener('click', () => app.go('home'));
  return h('div', { class: 'screen page' },
    h('header', { class: 'page-top' }, back, h('h1', {}, title), h('span', { class: 'spacer' })),
    h('div', { class: 'page-body' }, ...children));
}

export function logo(): HTMLDivElement {
  const word = 'ROJO';
  const colors = [2, 1, 0, 2];
  return h('div', { class: 'logo', role: 'img', 'aria-label': 'Rojo' },
    ...word.split('').map((ch, i) => h('span', { class: 'logo-tile' }, tileSvg(colors[i]), h('b', {}, ch))));
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string): HTMLLabelElement {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'toggle' },
    h('span', { class: 'toggle-text' }, label, hint ? h('small', {}, hint) : null),
    input,
    h('span', { class: 'switch', 'aria-hidden': 'true' }));
}

export function segmented<T extends string | number>(
  options: Array<{ value: T; label: string }>,
  value: T,
  onChange: (v: T) => void,
  label: string,
): HTMLDivElement {
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const buttons = options.map((o) => {
    const b = h('button', { role: 'radio', 'aria-checked': String(o.value === value) }, o.label);
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.setAttribute('aria-checked', 'false'));
      b.setAttribute('aria-checked', 'true');
      onChange(o.value);
    });
    group.append(b);
    return b;
  });
  return group;
}
