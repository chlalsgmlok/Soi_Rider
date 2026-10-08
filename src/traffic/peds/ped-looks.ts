import type { Rng } from '../../core/rng';
import type { Pedestrian } from './pedestrian';

/** share of walkers who open an umbrella in the rain */
const UMBRELLA_SHARE = 0.55;
/** rain level at which umbrellas come out */
export const UMBRELLA_RAIN = 0.22;

/** stable 0..1 value from a look seed and a channel (so a pedestrian's choices never flicker) */
export function lookUnit(look: number, channel: number): number {
  let h = (look ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** umbrellas follow the weather; monks and vendors never carry one */
export function updateUmbrella(p: Pedestrian, rain: number): void {
  p.umbrella = p.role === 'walker' && rain > UMBRELLA_RAIN && lookUnit(p.look, 7) < UMBRELLA_SHARE;
}

/** personal walking habit: speed, preferred offset in the strip */
export function walkerHabits(p: Pedestrian, width: number, rng: Rng): void {
  p.cruise = p.role === 'monk' ? 0.85 : rng.range(1.05, 1.55);
  p.habit = p.role === 'monk' ? 0 : rng.range(-0.25, 0.3) * Math.max(0.4, width / 2);
  p.off = p.offTarget = p.habit;
  p.speed = p.cruise;
  p.thinkTimer = rng.range(2, 9);
}
