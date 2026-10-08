import { saturate } from '../core/curves';
import { gate, perc, sweep, swell } from '../core/envelope';
import { firingShape, periodicFromShape } from '../core/periodic';
import type { Voice } from '../core/voice';
import type { SfxParams } from '../types';
import { def, type SfxDef } from './sfx-def';
import { burst, thump } from './sfx-kit';

/** Things going past: air pressure whooshes, 2-stroke tuk-tuks, scooters, a bus hissing to a stop. */

/** near-miss air whoosh: band of noise falling in pitch (Doppler) while it pans past on `side` */
const whoosh = def((v, t, o) => {
  const s = Math.max(5, o.speedKmh);
  const dur = Math.min(0.5, Math.max(0.2, 0.62 - s / 160));
  const side = o.side || 1;
  const pan = v.panner(side * 0.3, v.out);
  pan.pan.setValueAtTime(side * 0.3, t);
  pan.pan.linearRampToValueAtTime(side * 0.95, t + dur * 1.6);
  const peak = 0.5 * (0.4 + 0.6 * o.intensity);
  const g = v.gain(0, pan);
  const f = v.filter('bandpass', 1800, 1.4, g);
  v.noise('pink', t, t + dur * 2.4, f);
  sweep(f.frequency, t, (900 + s * 22) * o.pitch, (380 + s * 6) * o.pitch, dur * 1.6);
  swell(g.gain, t, peak, dur * 0.55, dur * 1.2);
  const low = v.gain(0, pan);
  v.noise('brown', t, t + dur * 2.4, v.filter('lowpass', 260, 0.7, low));
  swell(low.gain, t, peak * 0.7, dur * 0.6, dur);
}, 0.06, 0.05);

interface PassSpec {
  key: string;
  firing: ReadonlyArray<readonly [number, number]>;
  width: number;
  /** firing cycle frequency at cruise */
  hz: number;
  formants: ReadonlyArray<readonly [number, number]>;
  drive: number;
  dur: number;
  level: number;
}

/** a small engine passing by: pulse train → formants → grit, Doppler pitch drop and a pan sweep */
function passBy(v: Voice, t: number, o: SfxParams, p: PassSpec): void {
  const dir = o.side || (v.rng.chance(0.5) ? 1 : -1);
  const end = t + p.dur;
  const pan = v.panner(-dir * 0.85, v.out);
  pan.pan.setValueAtTime(-dir * 0.85, t);
  pan.pan.linearRampToValueAtTime(dir * 0.85, end);
  const amp = v.gain(0, pan);
  swell(amp.gain, t, p.level * (0.5 + 0.5 * o.intensity), p.dur * 0.5, p.dur * 0.5);
  const lp = v.filter('lowpass', 4200, 0.7, amp);
  const sat = v.shaper(saturate(p.drive, 0.2), lp);
  const sum = v.gain(5, sat);
  const hz = p.hz * o.pitch * (0.92 + v.rng.next() * 0.16);
  const bands = p.formants.map(([f, q]) => v.filter('bandpass', f, q, sum));
  const osc = v.wave(periodicFromShape(v.ctx, p.key, firingShape(p.firing, p.width), 200), hz * 1.05, t, end + 0.05, bands[0]);
  for (const b of bands.slice(1)) osc.connect(b);
  osc.frequency.setValueAtTime(hz * 1.05, t);
  osc.frequency.setValueAtTime(hz * 1.05, t + p.dur * 0.38);
  osc.frequency.linearRampToValueAtTime(hz * 0.95, t + p.dur * 0.62);
  // uneven firing (4-stroking at part throttle): slow noise wobbling the level
  const wob = v.gain(3, sum.gain);
  v.noise('brown', t, end + 0.05, v.filter('lowpass', 9, 0.7, wob), 3);
  burst(v, t + p.dur * 0.45, 'pink', 'bandpass', 900, 1, p.dur * 0.1, p.dur * 0.3, 0.12 * p.level);
}

const tuktukPass = def((v, t, o) => passBy(v, t, o, {
  key: 'fire:2stroke', firing: [[0, 1]], width: 0.05, hz: 76, drive: 3,
  formants: [[1150, 3], [2500, 3], [480, 2]], dur: 2.4, level: 0.5,
}), 0.8, 0.2);

const motoPass = def((v, t, o) => passBy(v, t, o, {
  key: 'fire:moto', firing: [[0, 1]], width: 0.035, hz: 48, drive: 2.2,
  formants: [[170, 4], [430, 4], [1150, 3]], dur: 1.7, level: 0.55,
}), 0.4, 0.2);

/** city bus: brake squeal, valve click, the big "psssh" of the air brakes, tank thump */
const busBrake = def((v, t, o) => {
  const sq = v.gain(0, v.out);
  const s = v.osc('sine', 2650 * o.pitch, t, t + 0.65, sq);
  const vib = v.gain(18, s.frequency);
  v.osc('sine', 6, t, t + 0.65, vib);
  gate(sq.gain, t, 0.04, 0.05, 0.42, 0.1);
  const h = t + 0.55;
  burst(v, h, 'white', 'bandpass', 1200, 2, 0.001, 0.03, 0.3);
  const hiss = v.gain(0, v.out);
  v.noise('white', h, h + 1.4, v.filter('highpass', 2800, 0.7, v.filter('bandpass', 5200, 0.6, hiss)));
  perc(hiss.gain, h, 0.42 * (0.6 + 0.4 * o.intensity), 0.015, 1.1);
  thump(v, h + 0.02, 75, 55, 0.2, 0.2);
}, 1.2, 0.3);

export const TRAFFIC_SFX = {
  whoosh, tuktuk_pass: tuktukPass, moto_pass: motoPass, bus_brake: busBrake,
} satisfies Record<string, SfxDef>;
