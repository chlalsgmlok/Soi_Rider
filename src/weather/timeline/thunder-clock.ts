import { smoothstep } from '../../core/math2d';
import type { Rng } from '../../core/rng';
import type { Strike } from '../types';

/** strike pacing (seconds) and distances (km) */
export const THUNDER = {
  /** the build-up's first rumble lands this long after the downpour starts */
  firstMin: 1.4,
  firstMax: 2.4,
  /** mean seconds between strikes at activity 0.35 / 1 */
  calmGap: 24,
  stormGap: 7,
  nearKm: 0.6,
  farKm: 6,
  /** the flash flickers this long */
  flashSec: 0.6,
} as const;

/** lightning brightness `t` seconds after a strike: a bright return stroke and two re-strokes (pure, 0..1) */
export function flashAt(t: number): number {
  if (t < 0 || t > THUNDER.flashSec) return 0;
  const pulse = (t0: number, a: number, k: number): number => (t >= t0 ? a * Math.exp(-(t - t0) * k) : 0);
  return Math.min(1, pulse(0, 1, 18) + pulse(0.11, 0.7, 16) + pulse(0.23, 0.45, 9));
}

/** peak flash for a strike `km` away: close strikes light the whole street, far ones a patch of cloud */
export const strikePower = (km: number): number => 0.3 + 0.7 * (1 - smoothstep(THUNDER.nearKm, THUNDER.farKm, km));

/**
 * Schedules lightning while a downpour builds and falls (deterministic from the run Rng). `update` returns the
 * strike that happened during this step (the bus 'thunder' event) and keeps the current flash brightness.
 */
export class ThunderClock {
  /** current flash brightness 0..1 */
  flash = 0;
  private wait = Infinity;
  private since = Infinity;
  private power = 0;
  /** the next strike is the build-up's opening rumble (from a distance) */
  private opening = false;

  constructor(private readonly rng: Rng) {}

  /** a downpour just started: the first rumble comes during the build-up, from a distance */
  arm(): void {
    this.wait = this.rng.range(THUNDER.firstMin, THUNDER.firstMax);
    this.opening = true;
  }

  /** `activity` 0..1 = storminess now (0 = no thunder unless an opening rumble is pending) */
  update(dt: number, activity: number): Strike | null {
    this.since += dt;
    let strike: Strike | null = null;
    if (activity > 0 || this.opening) {
      this.wait -= dt;
      if (this.wait <= 0) {
        strike = this.strike(this.opening ? this.rng.range(2.5, 4.5) : undefined);
        const gap = THUNDER.calmGap + (THUNDER.stormGap - THUNDER.calmGap) * Math.max(0, (activity - 0.35) / 0.65);
        this.wait = gap * this.rng.range(0.45, 1.55);
      }
    } else this.wait = Math.max(this.wait, THUNDER.stormGap);
    this.flash = flashAt(this.since) * this.power;
    return strike;
  }

  /** force a strike now (also used by the scheduler); random distance unless given */
  strike(km?: number): Strike {
    const d = km ?? THUNDER.nearKm + (THUNDER.farKm - THUNDER.nearKm) * this.rng.next() ** 0.7;
    this.since = 0;
    this.opening = false;
    this.power = strikePower(d);
    this.flash = this.power;
    return { km: d, power: this.power };
  }
}
