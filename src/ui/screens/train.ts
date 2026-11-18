import { adaptiveLevels, currentElo } from '../../coach/elo';
import type { Puzzle } from '../../coach/training/generate';
import { LESSONS, lessonExercises } from '../../coach/training/lessons';
import { type Card, grade, isDue, newCard } from '../../coach/training/srs';
import { isMistake } from '../../coach/verdict';
import type { GameState } from '../../engine';
import { getAll, FULLGAMES, kvGet, kvSet } from '../../storage/db';
import type { FullGame } from '../../storage/fullgames';
import { loadHistory } from '../../storage/history';
import {
  cardStats, DIFFICULTY_GAP, type DailyState, dayBefore, liveStreak, loadCards, loadDaily, loadFinals, loadLessons,
  saveCard, saveDaily, saveLessons, today,
} from '../../storage/training';
import type { App } from '../app';
import { botNames, DEFAULT_COACH, DEFAULT_TRAINING, type GameConfig } from '../config';
import { h } from '../dom';
import { services } from '../services';
import { emptyTrainingLog, type SavedGame } from '../session';
import { screen } from './common';
import { type Exercise, startExercises } from './exercise';

let lessonTarget = 0;

/** Crea las tarjetas de repaso que falten a partir de los fallos de las partidas guardadas. */
async function importCards(existing: Card[]): Promise<Card[]> {
  const have = new Set(existing.map((c) => c.id));
  const fulls = await getAll<FullGame>(FULLGAMES);
  const added: Card[] = [];
  const now = Date.now();
  for (const f of fulls) {
    for (const r of f.game.records) {
      const id = `${f.game.id}-${r.turn}`;
      if (!isMistake(r.label) || have.has(id)) continue;
      const c = { ...newCard(id, r.before, r.move, r.best, r.loss, r.label, r.tags, now), due: now };
      await saveCard(c);
      added.push(c);
      have.add(id);
    }
  }
  return [...existing, ...added];
}

function failCard(p: Puzzle, origin: string): Promise<void> {
  const c = newCard(`${origin}-${Date.now()}`, p.state, p.best, p.best, p.gap, 'error', []);
  return saveCard(c);
}

async function ensureDaily(): Promise<DailyState> {
  const day = today();
  const prev = await loadDaily();
  if (prev && prev.day === day && prev.puzzles.length) return prev;
  // La dificultad se ajusta con los resultados del último día jugado.
  let difficulty = prev?.difficulty ?? 2;
  if (prev && prev.day !== day) {
    const ok = prev.puzzles.filter((p) => p.result === 'ok').length;
    const tried = prev.puzzles.filter((p) => p.result).length;
    if (tried === prev.puzzles.length && ok === tried) difficulty = Math.min(5, difficulty + 1);
    else if (tried && ok === 0) difficulty = Math.max(1, difficulty - 1);
  }
  const seed = Number(day.replace(/-/g, ''));
  const puzzles: Puzzle[] = [];
  // Si en el tiempo previsto no salen 3, se relaja un poco la exigencia.
  for (const [k, factor] of [1, 0.75, 0.55].entries()) {
    const more = await services.analysis().call<Puzzle[]>({
      type: 'genPuzzles', seed: seed + k * 7919, count: 3 - puzzles.length, minGap: DIFFICULTY_GAP[difficulty] * factor, timeMs: 20000, analyzeMs: 800,
    }).promise;
    puzzles.push(...more);
    if (puzzles.length >= 3) break;
  }
  const d: DailyState = { day, puzzles, streak: prev?.streak ?? 0, lastSolvedDay: prev?.lastSolvedDay ?? null, difficulty };
  await saveDaily(d);
  return d;
}

async function startFinal(app: App, players: number): Promise<void> {
  const state = await services.analysis().call<GameState>({ type: 'genFinal', seed: (Math.random() * 1e9) | 0, players }).promise;
  const elo = currentElo(await loadHistory());
  const levels = adaptiveLevels(elo, players - 1);
  const names = botNames(players - 1);
  const prefs = await kvGet<{ coach?: GameConfig['coach'] }>('setupPrefs');
  const config: GameConfig = {
    players: [{ kind: 'human', name: 'Tú', level: 0 }, ...names.map((name, i) => ({ kind: 'bot' as const, name, level: levels[i] }))],
    starter: state.roundStarter,
    coach: { ...DEFAULT_COACH, ...(prefs?.coach ?? {}) },
    seed: 0,
    training: { ...DEFAULT_TRAINING, challenge: false },
    mode: 'final',
  };
  const game: SavedGame = {
    version: 1, id: `final-${Date.now()}`, config, state, undo: [], records: [], rounds: [], moves: [], startedAt: Date.now(),
    training: emptyTrainingLog(),
  };
  await kvSet('current', game);
  app.go('game');
}

export function trainScreen(root: HTMLElement, app: App): void {
  const reviewBox = h('div', { class: 'tr-body' }, h('p', { class: 'muted small' }, 'Cargando…'));
  const dailyBox = h('div', { class: 'tr-body' }, h('p', { class: 'muted small' }, 'Cargando…'));
  const finalsBox = h('div', { class: 'tr-body' });
  const lessonsBox = h('div', { class: 'tr-body' });
  root.append(screen('Entrenar', app,
    h('section', { class: 'card' }, h('h2', {}, 'Repaso de tus errores'), reviewBox),
    h('section', { class: 'card' }, h('h2', {}, 'Puzle del día'), dailyBox),
    h('section', { class: 'card' }, h('h2', {}, 'Entrenador de finales'), finalsBox),
    h('section', { class: 'card' }, h('h2', {}, 'Lecciones'), lessonsBox)));

  // ---------- repaso ----------
  void loadCards().then(importCards).then((cards) => {
    const st = cardStats(cards);
    const due = cards.filter((c) => isDue(c)).sort((a, b) => a.due - b.due).slice(0, 10);
    const go = h('button', { class: 'btn primary', disabled: due.length === 0 }, due.length ? `Repasar ${due.length}` : 'Nada pendiente hoy');
    go.addEventListener('click', () => startExercises(app, {
      title: 'Repaso',
      back: 'train',
      items: due.map((c): Exercise => ({ state: c.state, context: `Aquí jugaste una ${c.label === 'pifia' ? 'pifia' : c.label === 'error' ? 'jugada con error' : 'imprecisión'} (−${c.loss.toFixed(1).replace('.', ',')}).` })),
      onResult: (i, ok) => saveCard(grade(due[i], ok)),
    }));
    reviewBox.replaceChildren(
      h('p', { class: 'small' }, cards.length
        ? `${st.due} pendientes hoy · ${st.learning} en aprendizaje · ${st.learned} aprendidas.`
        : 'Aún no hay errores que repasar. Juega con el entrenador activado: cada imprecisión o fallo se guarda aquí.'),
      h('p', { class: 'small muted' }, 'Las posiciones en las que fallaste vuelven pasados unos días. Si aciertas, tardan más en volver; si fallas, vuelven mañana.'),
      go);
  });

  // ---------- puzle del día ----------
  function renderDaily(d: DailyState): void {
    const streak = liveStreak(d);
    const pending = d.puzzles.map((p, i) => ({ p, i })).filter(({ p }) => !p.result);
    const go = h('button', { class: 'btn primary', disabled: pending.length === 0 }, pending.length ? `Resolver (${pending.length})` : 'Hecho por hoy');
    go.addEventListener('click', () => startExercises(app, {
      title: 'Puzle del día',
      back: 'train',
      items: pending.map(({ p }) => ({ state: p.state, context: 'Hay una jugada claramente mejor que las demás.' })),
      onResult: async (k, ok) => {
        const { i, p } = pending[k];
        d.puzzles[i].result = ok ? 'ok' : 'fail';
        if (ok) {
          const t = today();
          if (d.lastSolvedDay !== t) {
            d.streak = d.lastSolvedDay === dayBefore(t) ? d.streak + 1 : 1;
            d.lastSolvedDay = t;
          }
        } else await failCard(p, 'puzle');
        await saveDaily(d);
      },
    }));
    dailyBox.replaceChildren(
      h('div', { class: 'daily-head' },
        h('span', { class: 'streak' }, streak ? `🔥 ${streak} ${streak === 1 ? 'día' : 'días'} seguidos` : 'Empieza tu racha hoy'),
        h('span', { class: 'muted small' }, `Dificultad ${d.difficulty}/5`)),
      h('div', { class: 'daily-dots' }, ...d.puzzles.map((p, i) => h('span', { class: `dot ${p.result ?? ''}`, title: `Puzle ${i + 1}` }, p.result === 'ok' ? '★' : p.result === 'fail' ? '✗' : String(i + 1)))),
      h('p', { class: 'small muted' }, 'Tres posiciones al día. La dificultad sube si las resuelves todas y baja si no aciertas ninguna.'),
      go);
  }
  void loadDaily().then((d) => {
    if (d && d.day === today() && d.puzzles.length) renderDaily(d);
    else {
      dailyBox.replaceChildren(h('p', { class: 'small muted' }, 'Preparando los puzles de hoy… (unos segundos)'));
      void ensureDaily().then(renderDaily).catch(() => dailyBox.replaceChildren(h('p', { class: 'small' }, 'No se pudieron preparar los puzles. Vuelve a entrar en un momento.')));
    }
  });

  // ---------- finales ----------
  void loadFinals().then((f) => {
    const b2 = h('button', { class: 'btn primary' }, 'Contra 1 bot');
    const b3 = h('button', { class: 'btn' }, 'Contra 2 bots');
    const busy = () => {
      b2.disabled = true;
      b3.disabled = true;
      b2.textContent = 'Preparando…';
    };
    b2.addEventListener('click', () => { busy(); void startFinal(app, 2); });
    b3.addEventListener('click', () => { busy(); void startFinal(app, 3); });
    finalsBox.replaceChildren(...[
      h('p', { class: 'small' }, 'Empiezas en la última ronda de una partida a medias, con opciones de ganar. El objetivo: terminar por delante.'),
      f.played ? h('p', { class: 'small muted' }, `Finales ganados: ${f.won} de ${f.played} (${Math.round((100 * f.won) / f.played)} %).`) : null,
      h('div', { class: 'row-btns' }, b2, b3),
    ].filter((x): x is HTMLParagraphElement | HTMLDivElement => x !== null));
  });

  // ---------- lecciones ----------
  void loadLessons().then((prog) => {
    /** Por qué está bloqueada una lección y qué hace falta para abrirla. */
    const lockReason = (i: number): string => {
      const prev = LESSONS[i - 1];
      const prevUnlocked = i - 1 === 0 || !!prog[LESSONS[i - 2].id]?.done;
      if (!prevUnlocked) return `Primero tienes que superar «${prev.title}», que también está bloqueada.`;
      const best = prog[prev.id]?.best;
      return best === undefined
        ? `Se desbloquea al acertar 4 de 5 ejercicios en «${prev.title}». Aún no la has intentado.`
        : `Se desbloquea al acertar 4 de 5 ejercicios en «${prev.title}». Tu mejor resultado ahí: ${best} de 5.`;
    };
    lessonsBox.replaceChildren(h('ol', { class: 'lessons' }, ...LESSONS.map((l, i) => {
      const p = prog[l.id];
      const unlocked = i === 0 || !!prog[LESSONS[i - 1].id]?.done;
      const status = p?.done ? `✓ ${p.best}/5` : !unlocked ? '🔒' : p ? `${p.best}/5` : 'Disponible';
      const note = !unlocked
        ? h('span', { class: 'lesson-lock' }, lockReason(i))
        : p && !p.done ? h('span', { class: 'lesson-lock' }, `Tu mejor resultado: ${p.best} de 5. Necesitas 4 para superarla.`) : null;
      const b = h('button', { class: `lesson${unlocked ? '' : ' locked'}`, disabled: !unlocked, 'aria-describedby': `lock-${l.id}` },
        h('span', { class: 'lesson-title' }, l.title), h('span', { class: 'muted small lesson-sum' }, l.summary),
        h('span', { class: 'lesson-status' }, status));
      if (note) {
        note.id = `lock-${l.id}`;
        b.append(note);
      }
      b.addEventListener('click', () => {
        lessonTarget = i;
        app.go('lesson');
      });
      return h('li', {}, b);
    })),
    h('p', { class: 'small muted' }, 'Las lecciones van en orden: acierta 4 de 5 ejercicios para desbloquear la siguiente.'));
  });
}

export function lessonScreen(root: HTMLElement, app: App): void {
  const l = LESSONS[lessonTarget];
  const ex = lessonExercises(l.id);
  const start = h('button', { class: 'btn primary big' }, `Ejercicios (${ex.length})`);
  start.disabled = ex.length === 0;
  start.addEventListener('click', () => startExercises(app, {
    title: l.title,
    back: 'train',
    items: ex.map((p) => ({ state: p.state })),
    onResult: (i, ok) => (ok ? undefined : failCard(ex[i], `leccion-${l.id}`)),
    onFinish: async (correct) => {
      const prog = await loadLessons();
      const prevBest = prog[l.id]?.best ?? 0;
      prog[l.id] = { best: Math.max(prevBest, correct), done: (prog[l.id]?.done ?? false) || correct >= 4 };
      await saveLessons(prog);
    },
  }));
  const s = screen(l.title, app,
    h('section', { class: 'card prose' },
      h('p', {}, h('b', {}, l.summary)),
      ...l.body.map((p) => h('p', {}, p))),
    h('section', { class: 'card prose' }, h('h2', {}, 'En la partida'), h('ul', {}, ...l.tips.map((t) => h('li', {}, t)))),
    start);
  const back = s.querySelector('.page-top .icon-btn');
  back?.replaceWith(Object.assign(h('button', { class: 'icon-btn', 'aria-label': 'Volver' }, '‹'), { onclick: () => app.go('train') }));
  root.append(s);
}
