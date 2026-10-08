import { gate, perc, sweep } from '../core/envelope';
import type { Voice } from '../core/voice';
import { ching } from '../music/inst-drums';
import { ranat } from '../music/inst-melodic';
import { degreeHz, midiHz, SCALES } from '../music/scales';
import { def, type SfxDef } from './sfx-def';
import { bell, burst, thump, tone } from './sfx-kit';

/** Feedback & mission sounds. Everything melodic sits in the bright major pentatonic so it layers with music. */
const PENTA = SCALES.laiSut;

/** the gram app identity: E6 → B6 → G#6, glassy FM bells (memorable, three notes, never more) */
export function gramMotif(v: Voice, t: number, gain: number): void {
  const notes: ReadonlyArray<readonly [number, number, number]> = [[0, 1318.5, 0.3], [0.085, 1975.5, 0.3], [0.17, 1661.2, 0.65]];
  for (const [at, hz, d] of notes) {
    bell(v, t + at, hz, 2, 1.1, d, 0.14 * gain);
    tone(v, t + at, 'sine', hz / 2, 0.002, d * 0.6, 0.05 * gain);
    burst(v, t + at, 'white', 'highpass', 5000, 0.7, 0.0005, 0.008, 0.08 * gain);
  }
}

/** classic two-step coin: B5 → E6 */
export function coinBling(v: Voice, t: number, gain: number, pitch = 1): void {
  const g = v.gain(0, v.filter('lowpass', 6000, 0.7, v.out));
  const sq = v.osc('square', 988 * pitch, t, t + 0.5, g);
  const si = v.osc('sine', 988 * pitch, t, t + 0.5, v.gain(1.6, g));
  for (const o of [sq, si]) o.frequency.setValueAtTime(1319 * pitch, t + 0.07);
  perc(g.gain, t, 0.07 * gain, 0.001, 0.42);
}

/** rubber stamp on the receipt: thud, paper slap, table knock */
export function stampHit(v: Voice, t: number, gain: number): void {
  thump(v, t, 90, 45, 0.28, 0.75 * gain);
  burst(v, t, 'white', 'lowpass', 2500, 0.7, 0.002, 0.12, 0.4 * gain);
  burst(v, t, 'white', 'bandpass', 420, 2, 0.001, 0.1, 0.3 * gain);
}

const combo = def((v, t, o) => {
  const hz = degreeHz(76, PENTA, Math.min(14, Math.max(0, o.combo - 1))) * o.pitch;
  const lead = tone(v, t, 'square', hz, 0.002, 0.11, 0.06, v.filter('lowpass', 4000, 0.7, v.out));
  sweep(lead.frequency, t, hz * 0.97, hz, 0.03);
  tone(v, t, 'sine', hz, 0.002, 0.18, 0.2);
  tone(v, t, 'sine', hz * 2, 0.002, 0.08, 0.05);
}, 0.04, 0.1);

/** combo cashed in: arpeggio that gets longer with the combo, coin glitter on top */
const comboCash = def((v, t, o) => {
  const n = Math.min(7, Math.max(3, 2 + Math.floor(o.combo / 2)));
  for (let k = 0; k < n; k++) bell(v, t + k * 0.055, degreeHz(79, PENTA, k), 3.5, 1.2, 0.4, 0.12);
  for (let k = 0; k < 6; k++) tone(v, t + n * 0.055 + v.rng.next() * 0.25, 'sine', 3500 + v.rng.next() * 2500, 0.001, 0.1, 0.03);
}, 0.3, 0.15);

/** perfect gap: rapid sparkle run + air shimmer + power-up swoop */
const perfect = def((v, t, o) => {
  for (let k = 0; k < 7; k++) bell(v, t + k * 0.035, degreeHz(84, PENTA, k) * o.pitch, 2, 1.4, 0.5, 0.08);
  burst(v, t, 'white', 'highpass', 6500, 0.7, 0.08, 0.6, 0.07);
  const up = tone(v, t, 'sine', 220, 0.01, 0.3, 0.12);
  sweep(up.frequency, t, 220, 660, 0.25);
}, 0.15, 0.2);

/** passing a queued car while filtering: wood-block tick that walks up the scale */
const filterPass = def((v, t, o) => {
  const hz = degreeHz(81, PENTA, o.combo % 5) * o.pitch;
  tone(v, t, 'sine', hz, 0.0008, 0.06, 0.18);
  burst(v, t, 'white', 'bandpass', hz * 1.5, 8, 0.0005, 0.04, 0.25);
}, 0.05, 0.05);

/** passenger on board: ranat run up + ching */
const pickup = def((v, t) => {
  [0, 1, 2, 4].forEach((d, k) => ranat(v, t + k * 0.085, degreeHz(79, PENTA, d), 0.2, 0.9));
  ranat(v, t + 0.36, degreeHz(79, PENTA, 5), 0.6, 1);
  ranat(v, t + 0.36, degreeHz(79, PENTA, 7), 0.6, 0.7);
  ching(v, t + 0.36, 0.8, true);
}, 0.8, 0.2);

/** arrived: resolving phrase with bass + ching-chap and a little coin glitter */
const dropoff = def((v, t) => {
  const phrase: ReadonlyArray<readonly [number, number, number]> = [[0, 4, 0.2], [0.1, 5, 0.2], [0.2, 7, 0.25], [0.32, 5, 0.2], [0.42, 4, 0.25], [0.55, 7, 0.9]];
  for (const [at, d, len] of phrase) ranat(v, t + at, degreeHz(79, PENTA, d), len, 0.95);
  tone(v, t + 0.55, 'sine', midiHz(43), 0.004, 0.7, 0.3);
  ching(v, t + 0.55, 0.9, true);
  ching(v, t + 0.82, 0.8, false);
  for (let k = 0; k < 5; k++) tone(v, t + 0.6 + v.rng.next() * 0.4, 'sine', 3800 + v.rng.next() * 2200, 0.001, 0.12, 0.025);
}, 1.2, 0.25);

const go = def((v, t) => {
  const up = tone(v, t, 'sine', 330, 0.01, 0.3, 0.15);
  sweep(up.frequency, t, 330, 990, 0.22);
  bell(v, t + 0.18, 1568, 2, 1.2, 0.5, 0.12);
  ching(v, t + 0.18, 1, true);
  thump(v, t + 0.18, 90, 50, 0.25, 0.4);
}, 0.8, 0.2);

/** "wah wah wah waaah" on a reedy saw through a wah filter */
const fail = def((v, t) => {
  const notes: ReadonlyArray<readonly [number, number]> = [[0, 76], [0.22, 74], [0.44, 71], [0.66, 69]];
  notes.forEach(([at, m], k) => {
    const last = k === notes.length - 1;
    const len = last ? 0.85 : 0.2;
    const g = v.gain(0, v.out);
    const f = v.filter('lowpass', 700, 4, g);
    const o = v.osc('sawtooth', midiHz(m), t + at, t + at + len + 0.1, f);
    f.frequency.setValueAtTime(600, t + at);
    f.frequency.linearRampToValueAtTime(1800, t + at + len * 0.4);
    f.frequency.linearRampToValueAtTime(600, t + at + len);
    if (last) sweep(o.frequency, t + at + 0.2, midiHz(m), midiHz(m - 1), 0.6);
    gate(g.gain, t + at, 0.11, 0.02, len - 0.06, 0.06);
  });
}, 1.5, 0.2);

const warn = def((v, t) => {
  tone(v, t, 'sine', 660, 0.004, 0.1, 0.16);
  tone(v, t + 0.13, 'sine', 520, 0.004, 0.12, 0.16);
  tone(v, t, 'square', 660, 0.004, 0.08, 0.03, v.filter('lowpass', 1200, 0.7, v.out));
}, 0.8, 0.05);

export const REWARD_SFX = {
  combo, combo_cash: comboCash, perfect, filter_pass: filterPass, pickup, dropoff, go, fail, warn,
  coin: def((v, t, o) => coinBling(v, t, 1, o.pitch), 0.04, 0.08),
  stamp: def((v, t) => stampHit(v, t, 1), 0.2, 0.1),
  gram_ping: def((v, t) => gramMotif(v, t, 1), 0.9, 0.12),
} satisfies Record<string, SfxDef>;
