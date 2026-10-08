import { perc, sweep } from '../core/envelope';
import type { NoiseKind } from '../core/noise';
import type { Voice } from '../core/voice';

/** Small synthesis gestures every recipe is built from. All route into `dest` (default `v.out`). */

/** pitched thump: sine gliding f0 → f1 with a percussive envelope (impacts, kicks, stamps) */
export function thump(v: Voice, t: number, f0: number, f1: number, decay: number, gain: number, dest: AudioNode = v.out): OscillatorNode {
  const g = v.gain(0, dest);
  const o = v.osc('sine', f0, t, t + decay + 0.05, g);
  sweep(o.frequency, t, f0, f1, decay * 0.6);
  perc(g.gain, t, gain, 0.003, decay);
  return o;
}

/** filtered noise burst */
export function burst(
  v: Voice, t: number, kind: NoiseKind, type: BiquadFilterType, freq: number, q: number,
  attack: number, decay: number, gain: number, dest: AudioNode = v.out,
): BiquadFilterNode {
  const g = v.gain(0, dest);
  const f = v.filter(type, freq, q, g);
  v.noise(kind, t, t + attack + decay + 0.05, f);
  perc(g.gain, t, gain, attack, decay);
  return f;
}

/** oscillator with a percussive envelope */
export function tone(
  v: Voice, t: number, type: OscillatorType, freq: number, attack: number, decay: number, gain: number,
  dest: AudioNode = v.out,
): OscillatorNode {
  const g = v.gain(0, dest);
  const o = v.osc(type, freq, t, t + attack + decay + 0.05, g);
  perc(g.gain, t, gain, attack, decay);
  return o;
}

/**
 * FM mallet/bell: sine carrier, modulator at `ratio`·f whose index falls quickly (bright strike → pure ring).
 * ranat (Thai xylophone), hand bells, coins, the gram app motif.
 */
export function bell(
  v: Voice, t: number, freq: number, ratio: number, index: number, decay: number, gain: number,
  dest: AudioNode = v.out,
): void {
  const g = v.gain(0, dest);
  const end = t + decay + 0.06;
  const car = v.osc('sine', freq, t, end, g);
  const depth = v.gain(0, car.frequency);
  v.osc('sine', freq * ratio, t, end, depth);
  depth.gain.setValueAtTime(freq * index, t);
  depth.gain.setTargetAtTime(freq * index * 0.06, t, Math.max(0.01, decay * 0.1));
  perc(g.gain, t, gain, 0.0015, decay);
}

/** many short ticks on ONE noise source (debris, zips, applause, crackles); `times` ascending, relative to t */
export function ticks(
  v: Voice, t: number, times: readonly number[], gains: readonly number[], freq: number, q: number, tickDecay: number,
  dest: AudioNode = v.out, type: BiquadFilterType = 'bandpass',
): BiquadFilterNode {
  const g = v.gain(0, dest);
  const f = v.filter(type, freq, q, g);
  const end = t + (times[times.length - 1] ?? 0) + tickDecay * 2 + 0.05;
  v.noise('white', t, end, f);
  times.forEach((dt, i) => perc(g.gain, t + dt, gains[i % gains.length], 0.0008, tickDecay));
  return f;
}

/** `n` sorted random offsets within [from, to) */
export function scatter(v: Voice, n: number, from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(from + v.rng.next() * (to - from));
  return out.sort((a, b) => a - b);
}

/** `n` random gains within [lo, hi) */
export function jitterGains(v: Voice, n: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(lo + v.rng.next() * (hi - lo));
  return out;
}

/** soft cloth / plastic rustle: `swells` random crinkles over `span` seconds */
export function rustle(v: Voice, t: number, swells: number, span: number, gain: number, freq: number): void {
  const g = v.gain(0, v.out);
  const end = t + span + 0.3;
  v.noise('crackle', t, end, v.filter('bandpass', freq, 0.9, g));
  const body = v.gain(0, v.out);
  v.noise('pink', t, end, v.filter('bandpass', freq * 0.33, 1, body));
  for (const at of scatter(v, swells, 0, span)) {
    const k = 0.5 + v.rng.next() * 0.5;
    perc(g.gain, t + at, gain * k, 0.03, 0.14);
    perc(body.gain, t + at, gain * k * 0.35, 0.03, 0.12);
  }
}
