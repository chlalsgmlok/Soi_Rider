import type { Rng } from '../../core/rng';
import { type CityQuery, type PedestrianView, Surface } from '../../core/types';
import type { Obstacles } from '../sim/obstacles';
import type { SignalBank } from '../sim/signals';
import type { PedScare } from '../sim/types';
import type { PedCtx } from './ped-ctx';
import { PedPool } from './ped-pool';
import { type PedEnv, PedSpawner } from './ped-spawner';
import { applyPush, checkStartle, shove } from './ped-startle';
import { stepPedestrian } from './ped-walk';
import type { Pedestrian } from './pedestrian';
import { buildSidewalkNet, type SidewalkNet } from './sidewalk-net';

/**
 * Everyone on foot: sidewalk network, pool, spawner and the per-step walk / cross / startle logic. Pedestrians are
 * obstacles for vehicles (added to the shared grid by `addObstacles`) and read the same grid to find traffic gaps.
 */
export class Pedestrians {
  readonly net: SidewalkNet;
  readonly pool = new PedPool();
  onScare: ((e: PedScare) => void) | null = null;
  private readonly spawner: PedSpawner;
  private readonly ctx: PedCtx;

  constructor(city: CityQuery, signals: SignalBank, obstacles: Obstacles, rng: Rng) {
    this.net = buildSidewalkNet(city);
    this.spawner = new PedSpawner(this.net, city, this.pool, rng.fork('ped-spawn'));
    const pool = this.pool;
    this.ctx = {
      net: this.net, city, signals, obstacles, rng: rng.fork('ped-walk'), peds: pool.active,
      byId: (id) => pool.get(id), dt: 1 / 60, jaywalkChance: 0,
    };
  }

  get active(): readonly Pedestrian[] {
    return this.pool.active;
  }

  views(): readonly PedestrianView[] {
    return this.pool.active;
  }

  /**
   * Add every pedestrian as a circle obstacle (ref = index in `active`). Only people on the carriageway (crossing,
   * stepped off the kerb, pushed) are solid for vehicles — someone waiting on the kerb must not stop a bus.
   */
  addObstacles(ob: Obstacles): void {
    const list = this.pool.active;
    const city = this.ctx.city;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const s = city.surfaceAt(p.pos.x, p.pos.z);
      const onRoad = p.crossing || s === Surface.Road || s === Surface.Intersection || s === Surface.Crosswalk;
      ob.add('pedestrian', i, p.pos.x, p.pos.z, p.heading, p.radius, p.radius, p.speed, true, onRoad);
    }
  }

  populate(env: PedEnv): void {
    this.spawner.populate(env);
  }

  update(dt: number, env: PedEnv): void {
    const ctx = this.ctx;
    ctx.dt = dt;
    ctx.jaywalkChance = env.intensity.jaywalkChance;
    for (const p of this.pool.active) {
      stepPedestrian(p, ctx);
      const kmh = checkStartle(p, env.player, dt);
      applyPush(p, dt);
      if (kmh > 0) this.onScare?.({ id: p.id, pos: { x: p.pos.x, z: p.pos.z }, speedKmh: kmh });
    }
    this.spawner.update(dt, env);
  }

  nudge(id: number, ix: number, iz: number): boolean {
    const p = this.pool.get(id);
    if (!p) return false;
    shove(p, ix, iz);
    return true;
  }
}
