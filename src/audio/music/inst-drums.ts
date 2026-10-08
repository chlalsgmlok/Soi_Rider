import { perc } from '../core/envelope';
import type { Voice } from '../core/voice';
import { burst, thump, tone } from '../sfx/sfx-kit';

/** Percussion voices for the molam / luk thung grooves (also used by jingles). `vel` 0..1. */

export function kick(v: Voice, t: number, vel: number, dest: AudioNode = v.out): void {
  thump(v, t, 125, 44, 0.32, 0.9 * vel, dest);
  burst(v, t, 'white', 'highpass', 2500, 0.7, 0.0005, 0.008, 0.16 * vel, dest);
}

export function snare(v: Voice, t: number, vel: number, dest: AudioNode = v.out): void {
  burst(v, t, 'white', 'highpass', 1400, 0.7, 0.001, 0.16, 0.38 * vel, dest);
  burst(v, t, 'white', 'bandpass', 3800, 0.8, 0.001, 0.08, 0.18 * vel, dest);
  tone(v, t, 'triangle', 190, 0.001, 0.08, 0.32 * vel, dest);
}

/**
 * ching (open, ringing) / chap (choked): the pair of small Thai hand cymbals that keep the time cycle.
 * Inharmonic square partials through a high-pass, plus a bright noise strike.
 */
export function ching(v: Voice, t: number, vel: number, open: boolean, dest: AudioNode = v.out): void {
  const decay = open ? 0.62 : 0.07;
  const g = v.gain(0, v.filter('highpass', 2800, 0.7, dest));
  for (const f of [3150, 4210, 5380, 6890, 8120]) v.osc('square', f * (1 + (v.rng.next() - 0.5) * 0.004), t, t + decay + 0.05, g);
  perc(g.gain, t, (open ? 0.045 : 0.06) * vel, 0.001, decay);
  burst(v, t, 'white', 'bandpass', 7000, 1.2, 0.0005, open ? 0.12 : 0.04, (open ? 0.1 : 0.2) * vel, dest);
}

export function shaker(v: Voice, t: number, vel: number, dest: AudioNode = v.out): void {
  burst(v, t, 'white', 'highpass', 7500, 0.7, 0.004, 0.045, 0.18 * vel, dest);
}

/** klong / thon hand drum: tuned skin thump with a slap */
export function klong(v: Voice, t: number, vel: number, high: boolean, dest: AudioNode = v.out): void {
  thump(v, t, high ? 240 : 170, high ? 190 : 128, 0.28, 0.5 * vel, dest);
  burst(v, t, 'white', 'bandpass', 900, 1.5, 0.0008, 0.03, 0.12 * vel, dest);
}
