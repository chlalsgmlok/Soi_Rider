import type { EventBus } from '../../../core/events';
import type { Rng } from '../../../core/rng';
import type { Circle, TrafficQuery, Vec2 } from '../../../core/types';
import type { FxFrame } from '../fx-frame';
import { createSpec } from '../particles/particle-pool';
import type { ParticleLayer } from '../particles/particle-layer';

/** the rider as the splash check sees it (PlayerState fits) */
export interface SplashRider {
  readonly pos: Vec2;
  readonly heading: number;
  /** signed m/s */
  readonly speed: number;
}

/** puddles only splash once the city shows them (CityView puddles fade in from wet ≈ 0.12) */
export const SPLASH_WETNESS = 0.32;
/** slower than this the tyre just rolls through */
export const SPLASH_SPEED = 2.2;
/** a pedestrian this close to the splash gets soaked (mission penalty) */
export const SPLASH_REACH = 2.6;
/** the visible blob is a little smaller than its spot circle */
const INSIDE = 0.8;
const NPC_RANGE = 32;
const spec = createSpec();

/**
 * Riding through a puddle (CityView.puddleSpots) throws a sheet of water to both sides: droplets + mist, and the
 * bus 'splash' event ({ pos, onPedestrian }) for the mission penalty / audio. NPC vehicles near the rider splash
 * visually too (no event).
 */
export class PuddleSplash {
  private inside = -1;
  private readonly cooldown: Float32Array;
  /** indices of the spots around the focus (refreshed twice a second) */
  private near: number[] = [];
  private nearTimer = 0;

  constructor(
    private readonly spots: readonly Circle[], private readonly drops: ParticleLayer, private readonly mist: ParticleLayer,
    private readonly bus: EventBus, private readonly rng: Rng,
  ) {
    this.cooldown = new Float32Array(Math.max(1, spots.length));
  }

  update(f: FxFrame, rider: SplashRider | null, traffic: TrafficQuery | null): void {
    for (let i = 0; i < this.cooldown.length; i++) this.cooldown[i] = Math.max(0, this.cooldown[i] - f.dt);
    if (f.state.wetness < SPLASH_WETNESS) {
      this.inside = -1;
      return;
    }
    this.refresh(f);
    if (rider) {
      const hit = this.spotAt(rider.pos);
      if (hit >= 0 && hit !== this.inside && Math.abs(rider.speed) > SPLASH_SPEED && this.cooldown[hit] <= 0) {
        this.cooldown[hit] = 1.2;
        this.burst(f, rider, 1);
        this.bus.emit('splash', { pos: { x: rider.pos.x, z: rider.pos.z }, onPedestrian: this.pedNear(rider.pos, traffic) });
      }
      this.inside = hit;
    }
    if (!traffic) return;
    for (const a of traffic.agents()) {
      if (Math.abs(a.speed) < 3 || Math.abs(a.pos.x - f.focus.x) > NPC_RANGE || Math.abs(a.pos.z - f.focus.z) > NPC_RANGE) continue;
      const hit = this.spotAt(a.pos);
      if (hit < 0 || this.cooldown[hit] > 0) continue;
      this.cooldown[hit] = 0.9;
      this.burst(f, a, a.spec.width > 1.2 ? 1.6 : 1);
    }
  }

  private refresh(f: FxFrame): void {
    this.nearTimer -= f.dt;
    if (this.nearTimer > 0) return;
    this.nearTimer = 0.5;
    const reach = NPC_RANGE + 12;
    this.near = [];
    this.spots.forEach((s, i) => {
      if (Math.abs(s.cx - f.focus.x) < reach && Math.abs(s.cz - f.focus.z) < reach) this.near.push(i);
    });
  }

  private spotAt(p: Vec2): number {
    for (const i of this.near) {
      const s = this.spots[i];
      const dx = p.x - s.cx;
      const dz = p.z - s.cz;
      if (dx * dx + dz * dz < (s.r * INSIDE) ** 2) return i;
    }
    return -1;
  }

  private pedNear(p: Vec2, traffic: TrafficQuery | null): boolean {
    if (!traffic) return false;
    for (const ped of traffic.pedestrians()) {
      if (Math.hypot(ped.pos.x - p.x, ped.pos.z - p.z) < SPLASH_REACH + ped.radius) return true;
    }
    return false;
  }

  /** a fan of droplets thrown sideways and up from the tyre, plus a mist puff */
  private burst(f: FxFrame, m: SplashRider, scale: number): void {
    const v = Math.abs(m.speed);
    const fx = Math.sin(m.heading);
    const fz = Math.cos(m.heading);
    const rng = this.rng;
    const ground = f.groundHeight(m.pos.x, m.pos.z);
    const n = Math.min(90, Math.round((24 + v * 4) * scale));
    for (let i = 0; i < n; i++) {
      const side = rng.next() < 0.5 ? -1 : 1;
      const out = rng.range(1.6, 4.2) * (0.5 + v / 12) * side;
      spec.x = m.pos.x - fz * side * 0.15 + fx * rng.range(-0.3, 0.3);
      spec.z = m.pos.z + fx * side * 0.15 + fz * rng.range(-0.3, 0.3);
      spec.floor = ground + 0.02;
      spec.y = ground + 0.1;
      spec.vx = -fz * out + fx * v * rng.range(0.1, 0.45);
      spec.vz = fx * out + fz * v * rng.range(0.1, 0.45);
      spec.vy = rng.range(1.8, 3.8) * (0.55 + v / 16);
      spec.life = rng.range(0.45, 0.8);
      spec.size0 = rng.range(0.07, 0.13) * scale;
      spec.size1 = spec.size0 * 0.75;
      spec.alpha = 0.9;
      spec.r = spec.g = spec.b = 1;
      spec.drag = 0.35;
      spec.gravity = -9.8;
      this.drops.pool.emit(spec);
    }
    for (let i = 0; i < 10 * scale; i++) {
      spec.x = m.pos.x + rng.range(-0.4, 0.4);
      spec.z = m.pos.z + rng.range(-0.4, 0.4);
      spec.floor = ground + 0.05;
      spec.y = ground + 0.25;
      spec.vx = fx * v * 0.3 + rng.range(-1.2, 1.2);
      spec.vz = fz * v * 0.3 + rng.range(-1.2, 1.2);
      spec.vy = rng.range(0.4, 1.1);
      spec.life = rng.range(0.6, 1.1);
      spec.size0 = 0.45 * scale;
      spec.size1 = 1.8 * scale;
      spec.alpha = 0.3;
      spec.r = spec.g = spec.b = 0.9;
      spec.drag = 2;
      spec.gravity = -1.5;
      this.mist.pool.emit(spec);
    }
  }
}
