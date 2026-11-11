import { getSettings, onSettings, type Settings } from '../storage/settings';

/** Motor de audio: un único AudioContext, bus maestro con compresor y canales de efectos y música. */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  constructor() {
    onSettings((s) => this.apply(s));
  }

  /** Crea o reanuda el contexto. Debe llamarse dentro de un gesto del usuario. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.sfx = ctx.createGain();
      this.music = ctx.createGain();
      this.sfx.connect(comp);
      this.music.connect(comp);
      comp.connect(this.master);
      this.master.connect(ctx.destination);
      this.ctx = ctx;
      this.noiseBuf = this.makeNoise(ctx);
      this.apply(getSettings());
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  noise(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuf) return null;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    return n;
  }

  private apply(s: Settings): void {
    if (!this.ctx || !this.master || !this.music) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.volume, t, 0.02);
    this.music.gain.setTargetAtTime(s.music ? 0.22 : 0, t, 0.3);
    if (s.music && !s.muted) this.startMusic();
    else this.stopMusic();
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !getSettings().muted && getSettings().volume > 0;
  }

  // ---------- música ambiente ----------

  private startMusic(): void {
    if (this.musicTimer !== null || !this.ctx) return;
    const tick = () => this.playPad();
    tick();
    this.musicTimer = window.setInterval(tick, 5200);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  /** Pad suave con acordes de una progresión pentatónica. */
  private playPad(): void {
    const ctx = this.ctx;
    if (!ctx || !this.music || document.hidden) return;
    const progression = [
      [220, 277.18, 329.63, 440],
      [196, 246.94, 329.63, 392],
      [174.61, 220, 261.63, 349.23],
      [196, 246.94, 293.66, 392],
    ];
    const chord = progression[this.musicStep++ % progression.length];
    const t = ctx.currentTime + 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(this.music);
    for (const f of chord) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 1.8);
        g.gain.linearRampToValueAtTime(0.035, t + 4);
        g.gain.linearRampToValueAtTime(0, t + 6.5);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + 6.6);
      }
    }
  }
}

export const audio = new AudioEngine();
