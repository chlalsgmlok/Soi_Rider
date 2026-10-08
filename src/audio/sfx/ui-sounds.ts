import type { UiSfx } from '../../core/events';
import { gate, sweep } from '../core/envelope';
import { def, type SfxDef } from './sfx-def';
import { bell, burst, thump, tone } from './sfx-kit';
import { coinBling, gramMotif, stampHit } from './sfx-rewards';

/**
 * Interface sounds — short, soft, toy-like (rounded sine "tok"s, little FM bells), never harsh.
 * They play on the UI bus, so they stay crisp while the world is muffled behind a menu.
 */
export const UI_SFX: Record<UiSfx, SfxDef> = {
  tap: def((v, t, o) => {
    const k = tone(v, t, 'sine', 1400 * o.pitch, 0.001, 0.06, 0.3);
    sweep(k.frequency, t, 1400 * o.pitch, 900 * o.pitch, 0.03);
    burst(v, t, 'white', 'highpass', 3000, 0.7, 0.0005, 0.01, 0.12);
  }, 0.03, 0),

  hover: def((v, t, o) => {
    tone(v, t, 'sine', 2200 * o.pitch, 0.001, 0.03, 0.07);
  }, 0.04, 0),

  back: def((v, t, o) => {
    tone(v, t, 'triangle', 988 * o.pitch, 0.002, 0.08, 0.22);
    tone(v, t + 0.06, 'triangle', 740 * o.pitch, 0.002, 0.1, 0.22);
  }, 0.06, 0),

  /** cash register: drawer thunk + bell + coins */
  buy: def((v, t) => {
    thump(v, t, 160, 90, 0.1, 0.3);
    bell(v, t + 0.03, 2093, 2.4, 1.3, 0.6, 0.14);
    coinBling(v, t + 0.09, 0.8, 1.06);
    for (let k = 0; k < 4; k++) tone(v, t + 0.12 + v.rng.next() * 0.2, 'sine', 3500 + v.rng.next() * 2500, 0.001, 0.08, 0.03);
  }, 0.2, 0),

  /** soft "bzz-bzz" — clearly a no, without being punishing */
  deny: def((v, t) => {
    const g = v.gain(0, v.filter('lowpass', 900, 0.8, v.out));
    v.osc('square', 155, t, t + 0.3, g);
    v.osc('square', 158, t, t + 0.3, g);
    g.gain.setValueAtTime(0, t);
    for (const at of [0, 0.12]) {
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(0.09, t + at + 0.008);
      g.gain.setValueAtTime(0.09, t + at + 0.07);
      g.gain.linearRampToValueAtTime(0, t + at + 0.085);
    }
  }, 0.2, 0),

  coin: def((v, t, o) => coinBling(v, t, 0.9, o.pitch), 0.035, 0),

  stamp: def((v, t) => stampHit(v, t, 1.1), 0.2, 0),

  ping: def((v, t) => gramMotif(v, t, 0.75), 0.4, 0),

  /** air swish across the screen (screen transitions, crosswalk wipe) */
  swoosh: def((v, t, o) => {
    const pan = v.panner(-0.5, v.out);
    pan.pan.setValueAtTime(-0.5, t);
    pan.pan.linearRampToValueAtTime(0.5, t + 0.28);
    const g = v.gain(0, pan);
    const f = v.filter('bandpass', 600, 1.2, g);
    v.noise('pink', t, t + 0.35, f);
    sweep(f.frequency, t, 600 * o.pitch, 3200 * o.pitch, 0.25);
    gate(g.gain, t, 0.3, 0.08, 0.06, 0.16);
  }, 0.08, 0),

  /** latch clack + tiny chime: item equipped */
  equip: def((v, t) => {
    burst(v, t, 'white', 'bandpass', 1200, 5, 0.0008, 0.03, 0.45);
    tone(v, t, 'triangle', 820, 0.0008, 0.03, 0.12);
    bell(v, t + 0.05, 1760, 2, 0.8, 0.3, 0.1);
  }, 0.08, 0),

  /** receipt count-up tick */
  count: def((v, t) => {
    tone(v, t, 'sine', 2600 * (0.97 + v.rng.next() * 0.06), 0.001, 0.025, 0.1);
  }, 0.03, 0),
};
