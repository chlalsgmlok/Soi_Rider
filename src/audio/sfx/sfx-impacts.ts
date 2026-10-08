import { gate, sweep } from '../core/envelope';
import { def, type SfxDef } from './sfx-def';
import { burst, jitterGains, scatter, thump, ticks, tone } from './sfx-kit';

/** Contacts, falls and bike mechanics. Intensity scales mass and length; pitch is slightly randomised. */

const crash = def((v, t, o) => {
  const i = 0.5 + 0.5 * o.intensity;
  thump(v, t, 95 * o.pitch, 36, 0.5, 0.75 * i);
  burst(v, t, 'white', 'lowpass', 3200, 0.7, 0.002, 0.35, 0.42 * i);
  for (const [r, d] of [[1, 0.6], [2.32, 0.42], [3.87, 0.3], [5.1, 0.22]] as const) {
    tone(v, t + 0.004, 'sine', 410 * r * o.pitch, 0.002, d, 0.06 * i);
  }
  burst(v, t + 0.01, 'crackle', 'highpass', 2500, 0.7, 0.003, 0.55, 0.45 * i);
  const g = v.gain(0, v.out);
  const f = v.filter('bandpass', 1300, 1.4, g);
  v.noise('pink', t + 0.05, t + 1.3, f);
  sweep(f.frequency, t + 0.05, 1500, 650, 1.1);
  gate(g.gain, t + 0.05, 0.16 * i, 0.04, 0.25 * i, 0.5);
  for (const at of scatter(v, 4, 0.06, 0.36)) tone(v, t + at, 'sine', 3000 + v.rng.next() * 3000, 0.001, 0.12, 0.03 * i);
}, 0.3, 0.25);

const bump = def((v, t, o) => {
  const i = 0.45 + 0.55 * o.intensity;
  thump(v, t, 140 * o.pitch, 70, 0.18, 0.55 * i);
  burst(v, t, 'white', 'lowpass', 1200, 0.7, 0.001, 0.12, 0.3 * i);
  burst(v, t, 'white', 'bandpass', 900 * o.pitch, 4, 0.001, 0.07, 0.25 * i);
}, 0.12, 0.1);

const thudPed = def((v, t, o) => {
  thump(v, t, 110 * o.pitch, 75, 0.15, 0.45);
  burst(v, t, 'pink', 'lowpass', 600, 0.7, 0.002, 0.1, 0.35);
}, 0.2, 0.08);

/** plastic mirror clack, then the mirror flips back on its pivot */
const mirrorClack = def((v, t, o) => {
  const p = o.pitch * (0.94 + v.rng.next() * 0.12);
  burst(v, t, 'white', 'bandpass', 2300 * p, 6, 0.0008, 0.05, 0.7);
  tone(v, t, 'triangle', 1750 * p, 0.0008, 0.04, 0.18);
  burst(v, t + 0.075, 'white', 'bandpass', 2900 * p, 7, 0.0008, 0.04, 0.4);
  tone(v, t + 0.075, 'triangle', 2150 * p, 0.0008, 0.03, 0.1);
  burst(v, t, 'white', 'highpass', 5000, 0.7, 0.0005, 0.012, 0.22);
}, 0.08, 0.12);

const curb = def((v, t, o) => {
  const i = 0.5 + 0.5 * o.intensity;
  thump(v, t, 160 * o.pitch, 55, 0.22, 0.75 * i);
  burst(v, t, 'pink', 'lowpass', 450, 0.7, 0.002, 0.15, 0.45 * i);
  burst(v, t + 0.03, 'white', 'bandpass', 300, 3, 0.001, 0.1, 0.3 * i);
  burst(v, t + 0.01, 'crackle', 'bandpass', 1800, 1, 0.001, 0.12, 0.2 * i);
}, 0.15, 0.08);

/** bike on its side sliding over asphalt */
const scrape = def((v, t, o) => {
  const i = 0.5 + 0.5 * o.intensity;
  const hold = 0.45 + 0.4 * i;
  thump(v, t, 120, 50, 0.3, 0.55 * i);
  const g = v.gain(0, v.out);
  const f = v.filter('bandpass', 1400, 1.2, g);
  v.noise('pink', t, t + hold + 0.7, f);
  sweep(f.frequency, t, 1400, 650, hold + 0.5);
  gate(g.gain, t, 0.3 * i, 0.03, hold, 0.5);
  const grit = v.gain(0, v.out);
  v.noise('crackle', t, t + hold + 0.7, v.filter('bandpass', 2600, 0.8, grit));
  gate(grit.gain, t, 0.28 * i, 0.03, hold, 0.45);
  const metal = v.gain(0, v.out);
  for (const hz of [2100, 3170]) v.osc('sine', hz, t, t + hold + 0.5, metal);
  gate(metal.gain, t + 0.05, 0.025 * i, 0.05, hold * 0.7, 0.3);
}, 0.5, 0.15);

/** tyre squeal one-shot (emergency brake, skid out) */
const skid = def((v, t, o) => {
  const i = 0.4 + 0.6 * o.intensity;
  const hold = 0.15 + 0.35 * i;
  const end = t + hold + 0.35;
  const g = v.gain(0, v.out);
  const band = v.filter('bandpass', 1400, 4, g);
  const jitter = v.gain(60);
  v.noise('white', t, end, v.filter('lowpass', 30, 0.7, jitter));
  for (const hz of [880, 1240]) {
    const s = v.osc('sawtooth', hz * o.pitch, t, end, band);
    jitter.connect(s.frequency);
    sweep(s.frequency, t, hz * o.pitch, hz * o.pitch * 0.9, hold + 0.3);
  }
  gate(g.gain, t, 0.09 * i, 0.02, hold, 0.25);
  const scrub = v.gain(0, v.out);
  v.noise('pink', t, end, v.filter('bandpass', 1700, 1, scrub));
  gate(scrub.gain, t, 0.12 * i, 0.02, hold, 0.2);
}, 0.25, 0.1);

const splash = def((v, t, o) => {
  const i = 0.45 + 0.55 * o.intensity;
  const f = burst(v, t, 'white', 'bandpass', 2600, 1.2, 0.004, 0.45, 0.5 * i);
  sweep(f.frequency, t, 2600, 700, 0.4);
  burst(v, t, 'pink', 'lowpass', 500, 0.7, 0.01, 0.3, 0.4 * i);
  const drops = v.gain(0, v.out);
  v.noise('drops', t + 0.06, t + 0.8, v.filter('highpass', 1500, 0.7, drops));
  gate(drops.gain, t + 0.06, 0.4 * i, 0.02, 0.2, 0.4);
}, 0.1, 0.15);

/** helmet handed over: knock-knock on the shell, then the strap buckle clicks */
const helmetKnock = def((v, t) => {
  burst(v, t, 'white', 'bandpass', 650, 3, 0.001, 0.07, 0.5);
  tone(v, t, 'triangle', 900, 0.001, 0.05, 0.14);
  burst(v, t + 0.11, 'white', 'bandpass', 720, 3, 0.001, 0.06, 0.4);
  tone(v, t + 0.11, 'triangle', 990, 0.001, 0.05, 0.1);
  burst(v, t + 0.38, 'white', 'highpass', 4000, 0.7, 0.0005, 0.012, 0.3);
  tone(v, t + 0.38, 'sine', 3200, 0.0005, 0.02, 0.08);
}, 0.4, 0.05);

/** rotary gearbox clunk */
const shift = def((v, t, o) => {
  thump(v, t, 220 * o.pitch, 110, 0.07, 0.3);
  burst(v, t, 'white', 'bandpass', 1500, 2, 0.0008, 0.03, 0.15);
  tone(v, t, 'sine', 2200, 0.0008, 0.05, 0.035);
}, 0.12, 0);

/** electric starter cranking (compression chug) until the engine catches */
const starter = def((v, t, o) => {
  const i = 0.5 + 0.5 * o.intensity;
  const crank = 0.4;
  const amp = v.gain(0, v.out);
  const chug = v.gain(0.5, amp);
  v.osc('square', 11, t, t + crank, v.gain(0.45, chug.gain));
  const motor = v.osc('sawtooth', 380, t, t + crank + 0.05, v.filter('bandpass', 700, 1.5, chug));
  sweep(motor.frequency, t, 360, 470, crank);
  v.noise('pink', t, t + crank + 0.05, v.filter('bandpass', 500, 1, v.gain(1.4, chug)));
  gate(amp.gain, t, 0.12 * i, 0.01, crank - 0.05, 0.04);
  thump(v, t + crank, 90, 60, 0.12, 0.3 * i);
  burst(v, t + crank, 'brown', 'lowpass', 400, 0.7, 0.002, 0.15, 0.3 * i);
}, 0.5, 0.05);

/** overrun crackle: unburnt fuel popping in the hot exhaust */
const backfire = def((v, t, o) => {
  const n = 2 + Math.round(o.intensity * 5);
  const times = scatter(v, n, 0.03, 0.85);
  const gains = jitterGains(v, n, 0.3, 0.8);
  ticks(v, t, times, gains, 750, 1, 0.035);
  ticks(v, t, times, gains.map((g) => g * 0.8), 300, 0.7, 0.05, v.out, 'lowpass');
}, 0.6, 0.15);

export const IMPACT_SFX = {
  crash, bump, thud_ped: thudPed, mirror_clack: mirrorClack, curb, scrape, skid, splash,
  helmet_knock: helmetKnock, shift, starter, backfire,
} satisfies Record<string, SfxDef>;
