import type { SoundName } from '../ui/gameView';
import { audio } from './engine';

interface Voice {
  ctx: AudioContext;
  out: AudioNode;
  t: number;
  /** Multiplicador de tono con variación aleatoria. */
  pitch: number;
  /** Multiplicador de velocidad/duración. */
  rate: number;
}

const PENTA = [0, 2, 4, 7, 9];

function semis(n: number): number {
  return 2 ** (n / 12);
}

/** Nota de la escala pentatónica (grado 0 = Do5). */
export function pentatonic(step: number): number {
  const oct = Math.floor(step / 5);
  return 523.25 * semis(PENTA[step % 5] + 12 * oct);
}

function env(v: Voice, peak: number, attack: number, decay: number): GainNode {
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, v.t);
  g.gain.exponentialRampToValueAtTime(peak, v.t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, v.t + attack + decay * v.rate);
  g.connect(v.out);
  return g;
}

function tone(v: Voice, freq: number, type: OscillatorType, peak: number, attack: number, decay: number, delay = 0): void {
  const vv = { ...v, t: v.t + delay };
  const o = v.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq * v.pitch;
  o.connect(env(vv, peak, attack, decay));
  o.start(vv.t);
  o.stop(vv.t + attack + decay * v.rate + 0.05);
}

function noiseBurst(v: Voice, type: BiquadFilterType, freq: number, q: number, peak: number, decay: number, delay = 0): void {
  const n = audio.noise();
  if (!n) return;
  const vv = { ...v, t: v.t + delay };
  const f = v.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq * v.pitch;
  f.Q.value = q;
  n.connect(f).connect(env(vv, peak, 0.002, decay));
  n.start(vv.t, Math.random() * 0.3);
  n.stop(vv.t + decay * v.rate + 0.05);
}

/** "Clink" cerámico: ruido filtrado más parciales inarmónicos con envolvente corta. */
function clink(v: Voice, gain: number, base: number): void {
  noiseBurst(v, 'bandpass', base * 1.6, 9, 0.25 * gain, 0.035);
  for (const [ratio, amp, dec] of [[1, 0.22, 0.13], [1.53, 0.14, 0.09], [2.37, 0.08, 0.06]] as const) {
    tone(v, base * ratio, 'sine', amp * gain, 0.002, dec);
  }
}

const CATALOG: Record<SoundName, (v: Voice, step: number) => void> = {
  select: (v) => tone(v, 1750, 'sine', 0.07, 0.002, 0.03),
  cancel: (v) => tone(v, 520, 'sine', 0.06, 0.003, 0.05),
  pick: (v) => clink(v, 1, 2150),
  botPick: (v) => clink(v, 0.4, 1650),
  drop: (v) => {
    clink(v, 0.7, 2700);
    tone(v, 3950, 'sine', 0.05, 0.002, 0.05, 0.018);
  },
  botDrop: (v) => clink(v, 0.3, 2200),
  floor: (v) => {
    const o = v.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(190 * v.pitch, v.t);
    o.frequency.exponentialRampToValueAtTime(85 * v.pitch, v.t + 0.12);
    o.connect(env(v, 0.32, 0.004, 0.16));
    o.start(v.t);
    o.stop(v.t + 0.25);
    noiseBurst(v, 'lowpass', 700, 1, 0.12, 0.06);
  },
  score: (v, step) => {
    const f = pentatonic(Math.min(step, 14)) / v.pitch;
    tone(v, f, 'triangle', 0.16, 0.004, 0.22);
    tone(v, f * 2, 'sine', 0.05, 0.004, 0.12);
  },
  combo: (v) => {
    [0, 4, 7, 12, 16].forEach((s, i) => tone(v, 392 * semis(s), 'triangle', 0.1, 0.01, 0.75, i * 0.035));
  },
  penalty: (v) => {
    tone(v, 72, 'sine', 0.38, 0.004, 0.18);
    noiseBurst(v, 'lowpass', 420, 1.2, 0.22, 0.09);
  },
  win: (v) => {
    const seq = [0, 4, 7, 12];
    seq.forEach((s, i) => tone(v, 523.25 * semis(s), 'sawtooth', 0.045, 0.01, 0.22, i * 0.12));
    seq.forEach((s, i) => tone(v, 523.25 * semis(s), 'triangle', 0.09, 0.01, 0.25, i * 0.12));
    [0, 4, 7, 12].forEach((s) => tone(v, 523.25 * semis(s), 'triangle', 0.08, 0.02, 1.1, 0.5));
  },
  lose: (v) => {
    [[5, 9, 12], [4, 7, 12]].forEach((ch, i) => ch.forEach((s) => tone(v, 261.63 * semis(s), 'sine', 0.07, 0.04, 0.8, i * 0.45)));
  },
  coachGood: (v) => {
    tone(v, 659.25, 'sine', 0.08, 0.005, 0.15);
    tone(v, 830.6, 'sine', 0.08, 0.005, 0.22, 0.09);
  },
  coachWarn: (v) => {
    tone(v, 493.88, 'triangle', 0.08, 0.005, 0.16);
    tone(v, 466.16, 'triangle', 0.08, 0.005, 0.24, 0.12);
  },
  round: (v) => {
    for (const [ratio, amp] of [[1, 0.1], [2.76, 0.04], [5.4, 0.02]] as const) tone(v, 880 * ratio, 'sine', amp, 0.003, 0.9);
  },
  deal: (v) => {
    for (let i = 0; i < 7; i++) noiseBurst(v, 'bandpass', 2400 + i * 140, 4, 0.06, 0.03, i * 0.05);
  },
};

/** Reproduce un sonido del catálogo con una pequeña variación aleatoria de tono y velocidad. */
export function playSound(name: SoundName, opts: { step?: number; bot?: boolean } = {}): void {
  if (!audio.ready || !audio.ctx || !audio.sfx) return;
  const ctx = audio.ctx;
  const out = opts.bot ? ctx.createGain() : audio.sfx;
  if (opts.bot && out instanceof GainNode) {
    out.gain.value = 0.45;
    out.connect(audio.sfx);
  }
  const voice: Voice = {
    ctx,
    out,
    t: ctx.currentTime + 0.005,
    pitch: 2 ** ((Math.random() - 0.5) * 0.06),
    rate: 1 + (Math.random() - 0.5) * 0.1,
  };
  CATALOG[name](voice, opts.step ?? 0);
}

/** Vibración háptica breve (desactivable). */
export function haptic(pattern: number | number[], enabled: boolean): void {
  if (!enabled || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* sin soporte */
  }
}
