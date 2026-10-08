import type { IntensityConfig } from '../../core/config/traffic';
import type { Rng } from '../../core/rng';
import type { CityQuery, Placement, StaticCollider } from '../../core/types';
import { localToWorld } from '../../core/math2d';
import type { TrafficCaps, TrafficConditions, TrafficPlayer, ViewProbe } from '../sim/types';
import { updateUmbrella, walkerHabits } from './ped-looks';
import type { PedPool } from './ped-pool';
import type { Pedestrian } from './pedestrian';
import { stripPoint, type SidewalkNet } from './sidewalk-net';

const RING = 110;
const SPAWN_MIN = 34;
const BLIND_VIEW = 70;
/** walkers per 100 m of sidewalk per unit of INTENSITY.pedestrianDensity */
const PER_100M = 2.6;
const VENDOR_RANGE = 85;
const SAMPLE = 8;
const near: StaticCollider[] = [];

export interface PedEnv {
  player: TrafficPlayer;
  probe: ViewProbe | null;
  caps: TrafficCaps;
  intensity: IntensityConfig;
  conditions: TrafficConditions;
}

interface Sample {
  strip: number;
  s: number;
  x: number;
  z: number;
  d2: number;
}

/**
 * Pedestrian population around the rider: walkers on sidewalk strips (fewer at night, monk processions in the
 * morning), a vendor beside each food cart in range. Like the vehicle spawner it only spawns / removes people
 * where the camera cannot see, except for the first fill.
 */
export class PedSpawner {
  private readonly samples: Sample[] = [];
  private readonly carts: Placement[];
  private readonly staffed = new Map<number, Pedestrian>();
  private timer = 0;

  constructor(private readonly net: SidewalkNet, private readonly city: CityQuery, private readonly pool: PedPool, private readonly rng: Rng) {
    for (const st of net.strips) {
      for (let s = st.s0 + SAMPLE / 2; s < st.s1; s += SAMPLE) {
        const p = stripPoint(st, s, 0);
        this.samples.push({ strip: st.id, s, x: p.x, z: p.z, d2: 0 });
      }
    }
    this.carts = city.data.placements.filter((p) => p.asset === 'prop_food_cart');
  }

  update(dt: number, env: PedEnv): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    this.cycle(env, false);
  }

  populate(env: PedEnv): void {
    this.cycle(env, true);
  }

  private visible(env: PedEnv, x: number, z: number): boolean {
    const p = { x, z };
    return env.probe ? env.probe.isVisible(p, 1) : Math.hypot(x - env.player.pos.x, z - env.player.pos.z) < BLIND_VIEW;
  }

  private cycle(env: PedEnv, initial: boolean): void {
    const pl = env.player.pos;
    const { conditions, intensity, caps } = env;
    const night = conditions.timeOfDay === 'night' ? 0.55 : 1;
    let metres = 0;
    for (const k of this.samples) {
      k.d2 = (k.x - pl.x) ** 2 + (k.z - pl.z) ** 2;
      if (k.d2 < RING * RING) metres += SAMPLE;
    }
    const vendorCap = Math.min(10, Math.floor(caps.pedestrians * 0.25));
    const walkerCap = Math.max(0, caps.pedestrians - vendorCap);
    const density = intensity.pedestrianDensity * night * (caps.crowd ?? 1);
    const target = Math.min(walkerCap, Math.round((density * PER_100M * metres) / 100));
    for (let i = this.pool.active.length - 1; i >= 0; i--) {
      const p = this.pool.active[i];
      updateUmbrella(p, conditions.rain);
      const d = Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z);
      const far = p.role === 'vendor' ? VENDOR_RANGE + 25 : RING + 30;
      if (d > far + 80 || (d > far && !this.visible(env, p.pos.x, p.pos.z))) this.remove(p);
    }
    this.staffCarts(env, vendorCap, initial);
    let walkers = this.pool.active.length - this.staffed.size;
    for (let tries = 0; walkers < target && tries < (initial ? 400 : 8); tries++) {
      const k = this.draw(initial);
      const d = Math.sqrt(k.d2);
      if (d > RING || d < (initial ? 3 : SPAWN_MIN) || (!initial && this.visible(env, k.x, k.z))) continue;
      walkers += this.spawnGroup(k, conditions);
    }
  }

  /** a random strip sample; after the first fill the nearer of two draws, so people stream toward the rider */
  private draw(initial: boolean): Sample {
    const a = this.samples[Math.floor(this.rng.next() * this.samples.length)];
    if (initial) return a;
    const b = this.samples[Math.floor(this.rng.next() * this.samples.length)];
    return a.d2 < b.d2 ? a : b;
  }

  private remove(p: Pedestrian): void {
    if (p.cart >= 0) this.staffed.delete(p.cart);
    this.pool.despawn(p);
  }

  private spawnGroup(k: Sample, cond: TrafficConditions): number {
    const st = this.net.strips[k.strip];
    const monks = cond.timeOfDay === 'morning' && this.rng.chance(0.2) ? this.rng.int(1, 3) : 0;
    const dir: 1 | -1 = this.rng.chance(0.5) ? 1 : -1;
    let leader = -1;
    const n = Math.max(1, monks);
    for (let i = 0; i < n; i++) {
      const s = k.s - dir * i * 1.45;
      if (s < st.s0 || s > st.s1) break;
      const p = this.pool.spawn();
      p.role = monks > 0 ? 'monk' : 'walker';
      p.look = this.rng.int(0, 0x7fffffff);
      p.strip = k.strip;
      p.s = s;
      p.dir = dir;
      p.follow = leader;
      if (leader < 0) leader = p.id;
      walkerHabits(p, st.width, this.rng);
      updateUmbrella(p, cond.rain);
      const q = stripPoint(st, s, p.off);
      p.pos.x = q.x;
      p.pos.z = q.z;
    }
    return n;
  }

  /** a vendor stands beside every food cart near the rider (on whichever side of the cart is free) */
  private staffCarts(env: PedEnv, cap: number, initial: boolean): void {
    const pl = env.player.pos;
    for (let i = 0; i < this.carts.length && this.staffed.size < cap; i++) {
      const c = this.carts[i];
      if (this.staffed.has(i) || Math.hypot(c.pos.x - pl.x, c.pos.z - pl.z) > VENDOR_RANGE) continue;
      if (!initial && this.visible(env, c.pos.x, c.pos.z)) continue;
      const spot = this.vendorSpot(c);
      if (!spot) continue;
      const p = this.pool.spawn();
      p.role = 'vendor';
      p.mode = 'stand';
      p.cart = i;
      p.look = c.variant ^ 0x5bd1e995;
      p.pos.x = spot.x;
      p.pos.z = spot.z;
      p.heading = spot.h;
      this.staffed.set(i, p);
    }
  }

  private vendorSpot(c: Placement): { x: number; z: number; h: number } | null {
    for (const side of [1.9, -1.75]) {
      const p = localToWorld(c.pos, c.heading, side, -0.45);
      this.city.staticNear(p, 0.35, near);
      if (near.every((o) => o.id === c.collider)) return { x: p.x, z: p.z, h: c.heading + (side > 0 ? 0.6 : -0.6) };
    }
    return null;
  }
}
