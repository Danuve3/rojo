import {
  applyFloor, applyTurn, cloneState, finishRound, type GameState, isRoundOver, legalMoves, type Move, moveKey,
  type Source, tileLine, winners,
} from '../engine';
import { evaluate } from '../ai/evaluate';
import { canonicalMove } from '../coach/canonical';
import { challengeProgress } from '../coach/challenges';
import { describeMove, explainGood } from '../coach/explain';
import { COLOR_NAMES_PLURAL } from './colors';
import type { Analysis, Verdict } from '../coach/types';
import { kvDelete, kvSet } from '../storage/db';
import { getSettings } from '../storage/settings';
import { summarize } from '../coach/summary';
import { isMistake } from '../coach/verdict';
import { saveFullGame } from '../storage/fullgames';
import { saveHistory } from '../storage/history';
import { HUMAN, type TrainingConfig, trainingOf } from './config';
import { wait } from './dom';
import { GameView, type ViewEvents } from './gameView';
import { emptyTrainingLog, type SavedGame, type TrainingLog } from './session';

export interface BotProvider {
  chooseMove(s: GameState, level: number): Promise<Move>;
}

export interface CoachProvider {
  analyze(s: GameState): Promise<Analysis | null>;
  rate(before: GameState, move: Move, names: string[]): Promise<Verdict | null>;
  cancel(): void;
}

export interface ControllerDeps {
  bots: BotProvider;
  coach: CoachProvider | null;
  sound: ViewEvents['sound'];
  haptic: ViewEvents['haptic'];
  onExit(): void;
  onFinished(game: SavedGame): void;
}

const THINK_MS = { slow: 1100, normal: 650, fast: 220 } as const;

export class GameController {
  readonly view: GameView;
  private gen = 0;
  private destroyed = false;
  private idle = false;
  private pendingRates = new Set<Promise<unknown>>();
  private readonly training: TrainingConfig;
  private readonly log: TrainingLog;
  private guessResolve: ((g: { source: Source; color: number } | null) => void) | null = null;
  private countedRound = 0;

  constructor(private game: SavedGame, private deps: ControllerDeps) {
    this.training = trainingOf(game.config);
    this.log = game.training ??= emptyTrainingLog();
    this.view = new GameView(game.config, {
      onMove: (m) => void this.humanMove(m).catch((e) => console.error('Error al jugar', e)),
      onPredict: (m) => void this.finishPredict(m),
      onGuess: (g) => this.guessResolve?.(g),
      onSkip: () => this.view.setSkipping(true),
      onHint: () => void this.hint(),
      onUndo: () => this.undo(),
      onExit: () => deps.onExit(),
      sound: deps.sound,
      haptic: deps.haptic,
    });
  }

  get state(): GameState {
    return this.game.state;
  }

  mount(parent: HTMLElement): void {
    this.view.mount(parent);
    this.refreshCoachButtons();
    this.refreshChallenge();
    if (this.game.moves.length === 0 && this.state.round === 1) {
      void this.view.showInitialDeal(this.state).then(() => this.advance());
    } else {
      this.view.sync(this.state);
      void this.advance();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.gen++;
    this.view.destroy();
  }

  private save(): void {
    void kvSet('current', this.game);
  }

  private playerName(i: number): string {
    return this.game.config.players[i].name;
  }

  private async advance(): Promise<void> {
    try {
      await this.advanceInner();
    } catch (e) {
      console.error('Error en el bucle de juego', e);
    }
  }

  private async advanceInner(): Promise<void> {
    if (this.destroyed) return;
    const s = this.state;
    this.view.setSkipping(false);
    if (s.phase === 'over') {
      await this.finish();
      return;
    }
    if (s.current === HUMAN) {
      if (this.deps.coach) void this.deps.coach.analyze(cloneState(s));
      if (this.training.counting && this.countedRound !== s.round && Math.random() < 0.35) {
        this.countedRound = s.round;
        const g0 = this.gen;
        await this.countingQuestion(s);
        if (g0 !== this.gen || this.destroyed) return;
      }
      this.view.setStatus('Tu turno: toca un color');
      this.view.enableInput(s);
      this.idle = true;
      this.refreshCoachButtons();
      return;
    }
    const g = this.gen;
    const player = s.current;
    const cfg = this.game.config.players[player];
    this.view.setStatus(`${cfg.name} está pensando…`, true);
    const started = performance.now();
    const move = await this.deps.bots.chooseMove(cloneState(s), cfg.level);
    const minDelay = THINK_MS[getSettings().botSpeed] * (this.view.timeScale() > 0 ? 1 : 0.4);
    const left = minDelay - (performance.now() - started);
    if (left > 0) await wait(left);
    if (g !== this.gen || this.destroyed) return;
    if (this.training.guessRival && legalMoves(s).length > 3 && Math.random() < 0.4) {
      await this.guessRival(s, player, move);
      if (g !== this.gen || this.destroyed) return;
    }
    await this.view.previewBotMove(s, move);
    if (this.training.explainBots && cfg.level >= 6) this.explainBot(s, player, move);
    await this.play(move);
  }

  // ---------- ayudas de entrenamiento ----------

  private refreshChallenge(): void {
    const ch = this.game.challenge;
    if (!ch || !this.training.challenge) {
      this.view.setChallenge(null);
      return;
    }
    const p = challengeProgress(ch, this.game);
    this.view.setChallenge(ch.title, p.short, p.status);
  }

  /** «¿Qué hará el rival?»: el jugador señala qué cogerá el bot antes de verlo. */
  private async guessRival(s: GameState, player: number, move: Move): Promise<void> {
    const name = this.playerName(player);
    const guess = await new Promise<{ source: Source; color: number } | null>((resolve) => {
      this.guessResolve = resolve;
      this.view.startGuess(name, () => resolve(null));
    });
    this.guessResolve = null;
    this.view.endGuess();
    if (!guess) return;
    const actual = canonicalMove(s, move);
    const mine = canonicalMove(s, { source: guess.source, color: guess.color as Move['color'], target: 'floor' });
    const exact = actual.color === mine.color && actual.source === mine.source;
    const colorOk = actual.color === mine.color;
    this.log.guesses.n++;
    if (exact) this.log.guesses.exact++;
    else if (colorOk) this.log.guesses.color++;
    const src = (move.source === 'center' ? s.center : s.factories[move.source])[move.color];
    const what = describeMove(move, src).replace(/ a la línea \d| al suelo/, '');
    if (exact) {
      this.deps.sound('coachGood');
      this.view.say(`¡Exacto! ${name} coge ${what}.`, player, 'good');
    } else if (colorOk) {
      this.deps.sound('coachGood');
      this.view.say(`Color correcto, pero de otro sitio: ${what}.`, player, 'info');
    } else {
      this.deps.sound('coachWarn');
      this.view.say(`No: ${name} coge ${what}.`, player, 'bad');
    }
    this.save();
  }

  /** «Aprende del bot»: por qué ha elegido su jugada un bot fuerte. */
  private explainBot(s: GameState, player: number, move: Move): void {
    try {
      const ev = evaluate(cloneState(s), move, { rivals: true });
      const src = (move.source === 'center' ? s.center : s.factories[move.source])[move.color];
      const why = explainGood({ move, value: ev.total, visits: 0, factors: ev.factores, rival: ev.rival }, this.names());
      this.view.botNote(player, `${this.playerName(player)}: ${describeMove(move, src)}. ${why}`);
    } catch (e) {
      console.warn('No se pudo explicar la jugada del bot', e);
    }
  }

  /** Pregunta de conteo: cuántas losetas de un color faltan por salir (bolsa + caja). */
  private async countingQuestion(s: GameState): Promise<void> {
    const colors = [0, 1, 2, 3, 4].filter((c) => s.bag[c] + s.box[c] > 0);
    if (!colors.length) return;
    const c = colors[Math.floor(Math.random() * colors.length)];
    const answer = s.bag[c] + s.box[c];
    const near = [-3, -2, -1, 1, 2, 3, 4].map((d) => answer + d).filter((d) => d >= 0 && d <= 20);
    const distractors: number[] = [];
    while (distractors.length < 3 && near.length) distractors.push(near.splice(Math.floor(Math.random() * near.length), 1)[0]);
    const options = [answer, ...distractors].sort((a, b) => a - b);
    const picked = await this.view.ask(`¿Cuántos ${COLOR_NAMES_PLURAL[c]} faltan por salir (bolsa y caja)?`, options);
    if (picked === null) return;
    const table = s.center[c] + s.factories.reduce((a, f) => a + f[c], 0);
    let lines = 0;
    let walls = 0;
    let floors = 0;
    for (const p of s.players) {
      for (let r = 0; r < 5; r++) {
        if (p.lineColor[r] === c) lines += p.lineCount[r];
        if (p.wall & (1 << (r * 5 + ((c + r) % 5)))) walls++;
      }
      floors += p.floor.filter((t) => t === c).length;
    }
    const breakdown = `20 − ${table} en la mesa − ${lines} en líneas − ${walls} en muros − ${floors} en suelos = ${answer}`;
    this.log.counts.n++;
    if (picked === answer) {
      this.log.counts.correct++;
      this.deps.sound('coachGood');
      this.view.say(`¡Correcto! ${breakdown}.`, 'table', 'good');
    } else {
      this.deps.sound('coachWarn');
      this.view.say(`Eran ${answer}: ${breakdown}.`, 'table', 'bad');
    }
    this.save();
  }

  private async humanMove(m: Move): Promise<void> {
    this.idle = false;
    this.refreshCoachButtons();
    const before = cloneState(this.state);
    let rating: Promise<Verdict | null> | null = null;
    if (this.deps.coach) {
      this.deps.coach.cancel();
      const job = this.rateMove(before, m, this.gen);
      rating = job;
      this.pendingRates.add(job);
      void job.finally(() => this.pendingRates.delete(job));
    }
    this.game.undo.push({
      state: before,
      records: this.game.records.length,
      rounds: this.game.rounds.length,
      moves: this.game.moves.length,
    });
    if (this.game.undo.length > 60) this.game.undo.shift();
    await this.play(m, rating, before);
  }

  private get secondChance(): boolean {
    return !!this.deps.coach && this.training.secondChance;
  }

  private async play(m: Move, rating: Promise<Verdict | null> | null = null, before: GameState | null = null): Promise<void> {
    const s = this.state;
    const player = s.current;
    const g = this.gen;
    this.game.moves.push({ player, move: m });
    const turn = applyTurn(s, m);
    await this.view.showTurn(s, turn);
    if (rating && before && this.secondChance) {
      // Segunda oportunidad: se espera a la valoración antes de seguir.
      this.view.setStatus('El entrenador revisa tu jugada…', true);
      const v = await Promise.race([rating, wait(6000).then(() => null)]);
      if (g !== this.gen || this.destroyed) return;
      if (v && isMistake(v.label)) {
        this.deps.sound('coachWarn');
        const choice = await this.view.showRetry(v, before);
        if (g !== this.gen || this.destroyed) return;
        if (choice === 'retry') {
          this.log.retries++;
          this.restoreLastSnapshot();
          return;
        }
      }
    }
    if (isRoundOver(s)) await this.closeRound(s);
    if (g !== this.gen) return;
    this.refreshChallenge();
    this.save();
    void this.advance();
  }

  private async closeRound(s: GameState): Promise<void> {
    const round = s.round;
    for (let row = 0; row < 5; row++) {
      const placed = s.players.map((_, p) => tileLine(s, p, row)).filter((x) => x !== null);
      if (placed.length) await this.view.showPlacements(s, placed);
    }
    const pens = s.players.map((_, p) => applyFloor(s, p));
    await this.view.showPenalties(s, pens);
    const { gameOver, bonuses } = finishRound(s);
    this.refreshChallenge();
    this.game.rounds.push({ round, scores: s.players.map((p) => p.score - (bonuses[s.players.indexOf(p)]?.points ?? 0)) });
    if (gameOver) {
      await this.view.showBonuses(s, bonuses);
      this.game.rounds[this.game.rounds.length - 1].scores = s.players.map((p) => p.score);
    } else {
      await this.view.showRoundStart(s);
    }
  }

  private names(): string[] {
    return this.game.config.players.map((p) => p.name);
  }

  private refreshCoachButtons(): void {
    const c = this.game.config.coach;
    const on = !!this.deps.coach;
    this.view.hintBtn.hidden = !(on && c.hints) || this.training.noAids;
    this.view.undoBtn.hidden = !on;
    this.view.hintBtn.disabled = !this.idle;
    this.view.undoBtn.disabled = !this.idle || this.game.undo.length === 0;
  }

  /** Pista bajo demanda: las 3 mejores jugadas con su valor y explicación. */
  private async hint(): Promise<void> {
    const coach = this.deps.coach;
    if (!coach || !this.idle) return;
    if (this.training.predict) {
      if (this.view.predicting) {
        this.view.endPredict();
        this.view.setStatus('Tu turno: toca un color');
      } else this.view.startPredict();
      return;
    }
    await this.showBestMoves();
  }

  /** Predice antes de mirar: compara la candidata con las mejores jugadas. */
  private async finishPredict(candidate: Move): Promise<void> {
    this.view.endPredict();
    const coach = this.deps.coach;
    if (!coach) return;
    const g = this.gen;
    const s = this.state;
    this.view.setStatus('Comparando con las mejores…', true);
    const a = await coach.analyze(cloneState(s));
    if (g !== this.gen || !this.idle || !a || !a.moves.length) return;
    const key = moveKey(canonicalMove(s, candidate));
    const rank = a.moves.findIndex((m) => moveKey(m.move) === key);
    const best = a.moves[0];
    const loss = rank >= 0 ? Math.max(0, best.value - a.moves[rank].value) : null;
    const hit = rank === 0 || (loss !== null && loss <= 0.3);
    const lossTxt = loss === null ? '' : loss.toFixed(1).replace('.', ',');
    const text = rank === 0
      ? '¡Bien visto! Tu candidata es la mejor jugada.'
      : hit
        ? `Muy bien: tu candidata es prácticamente tan buena como la mejor (−${lossTxt}).`
        : rank > 0 && rank < 5
          ? `Tu candidata es la ${rank + 1}.ª mejor opción: pierde ~${lossTxt} frente a la mejor.`
          : rank >= 5
            ? `Tu candidata no está entre las mejores: pierde ~${lossTxt} frente a la mejor.`
            : 'Tu candidata no está entre las opciones serias: hay jugadas bastante mejores.';
    this.log.predictions.n++;
    if (hit) this.log.predictions.hits++;
    this.save();
    this.deps.sound(hit ? 'coachGood' : 'coachWarn');
    this.view.setStatus('Tu turno: toca un color');
    this.view.showHints(a.moves.slice(0, 3), this.names(), s, { text, good: hit });
  }

  private async showBestMoves(): Promise<void> {
    const coach = this.deps.coach;
    if (!coach || !this.idle) return;
    const g = this.gen;
    const s = this.state;
    this.view.setStatus('Analizando…', true);
    this.view.hintBtn.disabled = true;
    const a = await coach.analyze(cloneState(s));
    if (g !== this.gen || !this.idle) return;
    this.view.hintBtn.disabled = false;
    this.view.setStatus('Tu turno: toca un color');
    if (!a || !a.moves.length) return;
    const top = a.moves.slice(0, 3);
    this.deps.sound('select');
    this.view.showHints(top, this.names(), s);
  }

  private async rateMove(before: GameState, m: Move, g: number): Promise<Verdict | null> {
    const coach = this.deps.coach;
    if (!coach) return null;
    const v = await coach.rate(before, m, this.names());
    if (!v || g !== this.gen || this.destroyed) return null;
    this.game.records.push({
      round: before.round,
      turn: before.turn,
      before,
      move: m,
      best: v.best.move,
      loss: v.loss,
      label: v.label,
      reasons: v.reasons,
      tags: v.tags,
      gap: v.gap,
    });
    this.save();
    this.refreshChallenge();
    const c = this.game.config.coach;
    if (isMistake(v.label) && this.secondChance) return v;
    if (!c.verdicts) return v;
    if (c.verdictMode === 'mistakes' && !isMistake(v.label)) return v;
    this.deps.sound(isMistake(v.label) ? 'coachWarn' : 'coachGood');
    this.view.showVerdict(v, before);
    return v;
  }

  /** Deshace la última jugada propia (y las de los bots que vinieron después). */
  private undo(): void {
    if (!this.idle || !this.deps.coach) return;
    this.restoreLastSnapshot();
  }

  private restoreLastSnapshot(): void {
    const snap = this.game.undo.pop();
    if (!snap) return;
    this.gen++;
    this.game.state = snap.state;
    this.game.records.length = Math.min(this.game.records.length, snap.records);
    this.game.rounds.length = Math.min(this.game.rounds.length, snap.rounds);
    this.game.moves.length = Math.min(this.game.moves.length, snap.moves);
    this.view.disableInput();
    this.view.hideCoach();
    this.view.sync(this.state);
    this.refreshChallenge();
    this.deps.sound('cancel');
    this.save();
    void this.advance();
  }

  private async finish(): Promise<void> {
    const w = winners(this.state);
    const won = w.includes(HUMAN);
    this.view.setStatus(won ? '¡Has ganado!' : `Gana ${w.map((i) => this.playerName(i)).join(' y ')}`);
    this.deps.sound(won ? 'win' : 'lose');
    if (won) this.view.celebrate(this.view.boardEl(HUMAN), 40);
    // Espera (con límite) a las valoraciones pendientes.
    if (this.pendingRates.size) {
      await wait(900);
      this.view.setStatus('El entrenador revisa la partida…', true);
      await Promise.race([Promise.all([...this.pendingRates]), wait(12000)]);
    }
    if (this.destroyed) return;
    const id = await saveHistory(summarize(this.game));
    if (id !== null) {
      this.game.historyId = id;
      await saveFullGame(id, this.game);
    }
    await kvDelete('current');
    this.deps.onFinished(this.game);
  }
}
