import { perc, sweep } from '../core/envelope';
import type { Voice } from '../core/voice';
import { bell, burst } from '../sfx/sfx-kit';

/** Pitched instruments: phin, ranat, khaen, bass. `vel` 0..1, `dur` = musical length in seconds. */

/** ring time (≈ −40 dB) of a note `dur` seconds long, per instrument — shared with the sample atlas */
export const NOTE_DECAY = {
  phin: (dur: number): number => Math.min(1.6, Math.max(0.3, dur * 1.4)),
  ranat: (dur: number): number => Math.min(0.9, Math.max(0.25, dur * 1.2)),
  bass: (dur: number): number => Math.min(0.9, Math.max(0.15, dur * 1.1)),
} as const;

/**
 * phin — the 3-string Isan lute: twangy saw+square pluck, nasal body peak, a lowpass that closes as the note
 * decays, and an optional hammer-on slide from `slideFrom` Hz.
 */
export function phin(v: Voice, t: number, hz: number, dur: number, vel: number, slideFrom = 0, dest: AudioNode = v.out): void {
  const decay = NOTE_DECAY.phin(dur);
  const end = t + decay + 0.05;
  const amp = v.gain(0, dest);
  const lp = v.filter('lowpass', 4500, 2.2, amp);
  const body = v.filter('peaking', 1100, 1.2, lp, 5);
  const a = v.osc('sawtooth', hz, t, end, body);
  const b = v.osc('square', hz, t, end, v.gain(0.45, body));
  b.detune.value = 6;
  if (slideFrom > 0) {
    for (const o of [a, b]) sweep(o.frequency, t, slideFrom, hz, 0.06);
  }
  sweep(lp.frequency, t, 5200, 900 + hz * 0.6, decay * 0.5);
  perc(amp.gain, t, 0.12 * vel, 0.002, decay);
  burst(v, t, 'white', 'bandpass', 3200, 1.5, 0.0005, 0.012, 0.1 * vel, dest);
}

/** ranat ek — hardwood xylophone: bright FM mallet with a woody knock */
export function ranat(v: Voice, t: number, hz: number, dur: number, vel: number, dest: AudioNode = v.out): void {
  bell(v, t, hz, 4, 1.6, NOTE_DECAY.ranat(dur), 0.15 * vel, dest);
  burst(v, t, 'white', 'bandpass', hz * 2.5, 3, 0.0005, 0.015, 0.08 * vel, dest);
}

/**
 * khaen — bamboo free-reed mouth organ playing a drone chord. `breath` gives one level per step: the player's
 * in/out breathing makes the characteristic pumping pulse of molam.
 */
export function khaen(
  v: Voice, t: number, stepDur: number, hzs: readonly number[], breath: readonly number[], level: number,
  dest: AudioNode = v.out,
): void {
  const steps = breath.length;
  const end = t + steps * stepDur;
  const amp = v.gain(0, dest);
  const tone = v.filter('bandpass', 1250, 0.6, v.filter('lowpass', 3000, 0.7, amp));
  const each = 1 / Math.max(1, hzs.length);
  for (const hz of hzs) {
    v.osc('sawtooth', hz, t, end + 0.15, v.gain(each, tone)).detune.value = -6;
    v.osc('square', hz, t, end + 0.15, v.gain(each * 0.5, tone)).detune.value = 7;
  }
  const g = amp.gain;
  g.setValueAtTime(0, t);
  for (let k = 0; k < steps; k++) g.setTargetAtTime(level * breath[k], t + k * stepDur, 0.035);
  g.setTargetAtTime(0, end, 0.05);
}

/** round electric bass pluck */
export function bass(v: Voice, t: number, hz: number, dur: number, vel: number, dest: AudioNode = v.out): void {
  const decay = NOTE_DECAY.bass(dur);
  const end = t + decay + 0.05;
  const amp = v.gain(0, dest);
  const lp = v.filter('lowpass', 900, 0.9, amp);
  v.osc('sine', hz, t, end, lp);
  v.osc('triangle', hz * 2, t, end, v.gain(0.25, lp));
  sweep(lp.frequency, t, 1400, 500, decay * 0.6);
  perc(amp.gain, t, 0.42 * vel, 0.004, decay);
}
