import { newGame, randomSeed } from '../../engine';
import { kvGet, kvSet } from '../../storage/db';
import type { App } from '../app';
import { botNames, DEFAULT_COACH, type CoachConfig, type GameConfig, type PlayerConfig } from '../config';
import { h } from '../dom';
import type { SavedGame } from '../session';
import { screen, segmented, toggle } from './common';

export const LEVEL_NAMES = ['', 'Aprendiz', 'Novato', 'Aficionado', 'Jugador', 'Competente', 'Astuto', 'Táctico', 'Experto', 'Maestro', 'Gran maestro'];

interface SetupPrefs {
  bots: number;
  levels: number[];
  starter: 'me' | 'random' | 'bot';
  coach: CoachConfig;
}

const DEFAULT_PREFS: SetupPrefs = { bots: 1, levels: [4, 5, 6], starter: 'me', coach: DEFAULT_COACH };

export function createGame(prefs: SetupPrefs): SavedGame {
  const names = botNames(prefs.bots);
  const players: PlayerConfig[] = [
    { kind: 'human', name: 'Tú', level: 0 },
    ...names.map((name, i) => ({ kind: 'bot' as const, name, level: prefs.levels[i] })),
  ];
  const n = players.length;
  const starter = prefs.starter === 'me' ? 0 : prefs.starter === 'bot' ? 1 : Math.floor(Math.random() * n);
  const seed = randomSeed();
  const config: GameConfig = { players, starter, coach: prefs.coach, seed };
  return {
    version: 1,
    id: `${Date.now()}-${seed >>> 0}`,
    config,
    state: newGame(n, seed, starter),
    undo: [],
    records: [],
    rounds: [],
    moves: [],
    startedAt: Date.now(),
  };
}

export function setupScreen(root: HTMLElement, app: App): void {
  const prefs: SetupPrefs = structuredClone(DEFAULT_PREFS);
  const botsBox = h('div', { class: 'bots' });
  const coachBox = h('div', { class: 'coach-opts' });

  function renderBots(): void {
    botsBox.replaceChildren(...Array.from({ length: prefs.bots }, (_, i) => {
      const out = h('output', {}, `${prefs.levels[i]} · ${LEVEL_NAMES[prefs.levels[i]]}`);
      const input = h('input', { type: 'range', min: 1, max: 10, step: 1, value: prefs.levels[i], 'aria-label': `Dificultad del bot ${i + 1}` });
      input.addEventListener('input', () => {
        prefs.levels[i] = Number(input.value);
        out.textContent = `${prefs.levels[i]} · ${LEVEL_NAMES[prefs.levels[i]]}`;
      });
      return h('div', { class: 'bot-row' }, h('div', { class: 'bot-label' }, h('span', {}, `Bot ${i + 1}`), out), input);
    }));
  }

  function renderCoach(): void {
    const c = prefs.coach;
    const sub = h('div', { class: 'sub', hidden: !c.enabled },
      toggle('Pistas bajo demanda 💡', c.hints, (v) => (c.hints = v), 'Las 3 mejores jugadas, explicadas'),
      toggle('Valorar cada jugada', c.verdicts, (v) => (c.verdicts = v)),
      h('div', { class: 'field' }, h('span', {}, 'Mostrar valoración'),
        segmented([{ value: 'always', label: 'Siempre' }, { value: 'mistakes', label: 'Solo fallos' }], c.verdictMode, (v) => (c.verdictMode = v), 'Cuándo mostrar la valoración')),
      toggle('Revisión al terminar', c.review, (v) => (c.review = v)),
      h('p', { class: 'muted small' }, 'Con el entrenador activo puedes deshacer jugadas.'));
    coachBox.replaceChildren(
      toggle('Modo entrenador', c.enabled, (v) => {
        c.enabled = v;
        sub.hidden = !v;
      }, 'Analiza con la IA más fuerte mientras piensas'),
      sub);
  }

  const botsSeg = h('div', {});
  function renderBotsSeg(): void {
    botsSeg.replaceChildren(segmented([1, 2, 3].map((v) => ({ value: v, label: `${v} bot${v > 1 ? 's' : ''}` })), prefs.bots, (v) => {
      prefs.bots = v;
      renderBots();
    }, 'Número de bots'));
  }
  const starterSeg = h('div', {});
  function renderStarter(): void {
    starterSeg.replaceChildren(segmented([
      { value: 'me', label: 'Yo' }, { value: 'random', label: 'Al azar' }, { value: 'bot', label: 'Bot 1' },
    ], prefs.starter, (v) => (prefs.starter = v as SetupPrefs['starter']), 'Quién empieza'));
  }

  const start = h('button', { class: 'btn primary big' }, 'Empezar');
  start.addEventListener('click', async () => {
    await kvSet('setupPrefs', prefs);
    const game = createGame(prefs);
    await kvSet('current', game);
    app.go('game');
  });

  root.append(screen('Nueva partida', app,
    h('section', { class: 'card' }, h('h2', {}, 'Rivales'), botsSeg, botsBox),
    h('section', { class: 'card' }, h('h2', {}, '¿Quién empieza?'), starterSeg),
    h('section', { class: 'card' }, h('h2', {}, 'Entrenador'), coachBox),
    start));

  const render = () => {
    renderBotsSeg();
    renderBots();
    renderStarter();
    renderCoach();
  };
  render();
  void kvGet<SetupPrefs>('setupPrefs').then((saved) => {
    if (!saved) return;
    Object.assign(prefs, { ...DEFAULT_PREFS, ...saved, coach: { ...DEFAULT_COACH, ...saved.coach } });
    render();
  });
}
