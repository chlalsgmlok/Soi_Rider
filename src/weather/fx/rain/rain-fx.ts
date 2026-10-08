import { Color, Group } from 'three';
import type { EventBus } from '../../../core/events';
import { damp } from '../../../core/math2d';
import type { Rng } from '../../../core/rng';
import type { Circle, TrafficQuery } from '../../../core/types';
import type { FxBudget } from '../fx-budget';
import { addScaled, type FxFrame } from '../fx-frame';
import { ParticleLayer } from '../particles/particle-layer';
import { PuddleSplash, type SplashRider } from './puddle-splash';
import { RainStreaks } from './rain-streaks';
import { SplashRings } from './splash-rings';
import { Spray } from './spray';
import { Steam } from './steam';

/** lens drops gather this fast in POV rain, linger after it stops, clear when the camera leaves the helmet */
const LENS = { gather: 1.4, linger: 0.3, clear: 2.5 } as const;

/**
 * Everything wet: GPU rain streaks, ripples, tyre spray (rider + registered sources + NPC traffic), puddle splashes
 * ('splash' bus event), after-rain steam and the POV lens water level (PostFx `wet`).
 */
export class RainFx {
  readonly root = new Group();
  readonly streaks: RainStreaks;
  readonly ripples: SplashRings;
  readonly spray: Spray;
  readonly splash: PuddleSplash;
  private readonly steam: Steam;
  private readonly mist: ParticleLayer;
  private readonly drops: ParticleLayer;
  private readonly lit = new Color();
  private lens = 0;

  constructor(budget: FxBudget, rng: Rng, bus: EventBus, puddles: readonly Circle[]) {
    this.root.name = 'weather_rain_fx';
    this.mist = new ParticleLayer(budget.mist, 'mist', 'weather_mist');
    this.drops = new ParticleLayer(budget.drops, 'drop', 'weather_drops');
    this.streaks = new RainStreaks(budget.rainDrops, rng.fork('streaks'));
    this.ripples = new SplashRings(budget.ripples, rng.fork('ripples'), puddles);
    this.spray = new Spray(this.mist, rng.fork('spray'));
    this.splash = new PuddleSplash(puddles, this.drops, this.mist, bus, rng.fork('splash'));
    this.steam = new Steam(this.mist, rng.fork('steam'));
    this.root.add(this.streaks.mesh, this.ripples.mesh, this.mist.mesh, this.drops.mesh);
  }

  /** live quality change: rain is rebuilt, the rest is clamped to what was allocated */
  setBudget(b: FxBudget): void {
    this.streaks.setCapacity(b.rainDrops);
    this.ripples.setLimit(b.ripples);
    this.mist.pool.limit = Math.min(this.mist.pool.capacity, b.mist);
    this.drops.pool.limit = Math.min(this.drops.pool.capacity, b.drops);
  }

  /** `sunlit` 0..1 (steam), `rider` for puddle splashes, `traffic` for NPC spray and soaked pedestrians */
  update(f: FxFrame, rider: SplashRider | null, traffic: TrafficQuery | null, sunlit: number): void {
    this.streaks.update(f);
    this.ripples.update(f);
    this.spray.update(f);
    this.splash.update(f, rider, traffic);
    this.steam.update(f, sunlit);
    const l = f.light;
    addScaled(this.lit.copy(l.ambient), l.sun, 0.55).add(l.lampGlow);
    this.mist.update(f.dt, f.wind.x, f.wind.z, this.lit);
    // droplets glint: they catch the sky and every lamp
    addScaled(this.lit.multiplyScalar(1.8), l.lampGlow, 2);
    this.drops.update(f.dt, f.wind.x * 0.2, f.wind.z * 0.2, this.lit);
  }

  /** advance and return the lens water level for PostFx `wet` (only the POV camera shows it) */
  lensWet(dt: number, rain: number, pov: boolean): number {
    const target = pov ? rain : 0;
    const rate = !pov ? LENS.clear : target > this.lens ? LENS.gather : LENS.linger;
    this.lens += (target - this.lens) * damp(rate, dt);
    return this.lens < 0.003 ? 0 : this.lens;
  }

  dispose(): void {
    this.streaks.dispose();
    this.ripples.dispose();
    this.mist.dispose();
    this.drops.dispose();
    this.root.removeFromParent();
  }
}
