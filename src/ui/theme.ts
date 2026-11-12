import { getSettings, onSettings, type Theme } from '../storage/settings';

const KEY = 'rojo-theme';

/** Aplica el tema elegido (o el del sistema) y lo recuerda para evitar parpadeos al cargar. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* sin almacenamiento */
  }
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1a1613' : '#c8402e');
}

export function setupTheme(): void {
  applyTheme(getSettings().theme);
  onSettings((s) => applyTheme(s.theme));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getSettings().theme));
}
