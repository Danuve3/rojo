import {
  applyFloor, applyTurn, cloneState, finishRound, type GameState, isRoundOver, type Move, tileLine, winners,
} from '../engine';
import type { Analysis, Verdict } from '../coach/types';
import { kvDelete, kvSet } from '../storage/db';
import { getSettings } from '../storage/settings';
import { HUMAN } from './config';
import { wait } from './dom';
import { GameView, type ViewEvents } from './gameView';
import type { SavedGame } from './session';

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

  constructor(private game: SavedGame, private deps: ControllerDeps) {
    this.view = new GameView(game.config, {
      onMove: (m) => void this.humanMove(m).catch((e) => console.error('Error al jugar', e)),
      onSkip: () => this.view.setSkipping(true),
      onHint: () => undefined,
      onUndo: () => undefined,
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
    this.view.sync(this.state);
    void this.advance();
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
      this.finish();
      return;
    }
    if (s.current === HUMAN) {
      this.view.setStatus('Tu turno: toca un color');
      this.view.enableInput(s);
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
    await this.view.previewBotMove(s, move);
    await this.play(move);
  }

  private async humanMove(m: Move): Promise<void> {
    this.game.undo.push({ state: cloneState(this.state), records: this.game.records.length, rounds: this.game.rounds.length });
    if (this.game.undo.length > 60) this.game.undo.shift();
    await this.play(m);
  }

  private async play(m: Move): Promise<void> {
    const s = this.state;
    const player = s.current;
    const g = this.gen;
    this.game.moves.push({ player, move: m });
    const turn = applyTurn(s, m);
    await this.view.showTurn(s, turn);
    if (isRoundOver(s)) await this.closeRound(s);
    if (g !== this.gen) return;
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
    this.game.rounds.push({ round, scores: s.players.map((p) => p.score - (bonuses[s.players.indexOf(p)]?.points ?? 0)) });
    if (gameOver) {
      await this.view.showBonuses(s, bonuses);
      this.game.rounds[this.game.rounds.length - 1].scores = s.players.map((p) => p.score);
    } else {
      await this.view.showRoundStart(s);
    }
  }

  private finish(): void {
    const w = winners(this.state);
    const won = w.includes(HUMAN);
    this.view.setStatus(won ? '¡Has ganado!' : `Gana ${w.map((i) => this.playerName(i)).join(' y ')}`);
    this.deps.sound(won ? 'win' : 'lose');
    if (won) this.view.celebrate(this.view.boardEl(HUMAN), 40);
    void kvDelete('current');
    this.deps.onFinished(this.game);
  }
}
