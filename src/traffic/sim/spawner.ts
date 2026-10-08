import { VEHICLES, type IntensityConfig } from '../../core/config/traffic';
import type { Rng } from '../../core/rng';
import type { OBB, VehicleKind, Vec2 } from '../../core/types';
import { exitNodes } from '../../world';
import { laneJitter } from './advance';
import { obbMayTouch, obbPenetration } from './obb-depth';
import { RingBudget, SAMPLE_LEN } from './ring-budget';
import { extendRoute } from './route';
import type { Tracks } from './tracks';
import type { TrafficCaps, TrafficPlayer, ViewProbe } from './types';
import { paintVehicle, pickCarKind, temperament } from './vehicle-mix';
import type { Vehicle } from './vehicle';
import type { VehiclePool } from './vehicle-pool';

/** never spawn (after the first fill) closer than this to the rider (m) */
const SPAWN_MIN = 42;
/** without a view probe, everything inside this radius (at most 55 % of the ring) counts as on screen */
const BLIND_VIEW = 70;
const STUCK_LIMIT: Record<string, number> = { light: 20, rush: 35, gridlock: 55 };
const padded: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };

export interface SpawnEnv {
  player: TrafficPlayer;
  probe: ViewProbe | null;
  intensity: IntensityConfig;
  caps: TrafficCaps;
}

/**
 * Keeps INTENSITY.density four-wheelers per lane-100 m around the rider, plus motorbikes so they make up
 * INTENSITY.motoShare of all vehicles — each kind inside the radius its budget can fill, so a capped budget stays
 * dense near the rider. Spawns only where the camera cannot see (or during the first fill), despawns
 * only far away and unseen — plus the deadlock breaker: a vehicle stuck far too long off screen quietly vanishes.
 */
export class Spawner {
  readonly ring: RingBudget;
  ringCars = 150;
  ringMotos = 150;
  unstuck = 0;
  private timer = 0;
  private readonly exits: ReadonlySet<number>;
  private readonly rnd = (): number => this.rng.next();
  private readonly laneDir = (lane: number): Vec2 => this.tracks.city.lanes[lane].dir;

  constructor(
    private readonly tracks: Tracks,
    private readonly pool: VehiclePool,
    private readonly rng: Rng,
    private weights: ReadonlyArray<[VehicleKind, number]>,
  ) {
    this.ring = new RingBudget(tracks);
    this.exits = new Set(exitNodes(tracks.city.nodes, tracks.city.bounds));
  }

  setWeights(w: ReadonlyArray<[VehicleKind, number]>): void {
    this.weights = w;
  }

  visible(env: SpawnEnv, p: Vec2, r: number): boolean {
    if (env.probe) return env.probe.isVisible(p, r);
    const blind = Math.min(BLIND_VIEW, Math.max(this.ringCars, this.ringMotos) * 0.55);
    return Math.hypot(p.x - env.player.pos.x, p.z - env.player.pos.z) < blind;
  }

  update(dt: number, env: SpawnEnv): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.4;
    this.cycle(env, false, 4);
  }

  /** fill the whole ring at once (start of a run / after an intensity change), ignoring visibility */
  populate(env: SpawnEnv): void {
    this.cycle(env, true, 2000);
  }

  private cycle(env: SpawnEnv, initial: boolean, maxSpawns: number): void {
    const { intensity, caps } = env;
    this.ring.sortAround(env.player.pos);
    // INTENSITY.density = four-wheelers per lane-100 m; motorbikes come on top so they make up motoShare of all
    const perM = intensity.density / 100;
    const share = Math.min(0.9, intensity.motoShare);
    const cars = this.ring.fit(perM, caps.cars);
    const motos = this.ring.fit((perM * share) / (1 - share), caps.motos);
    this.ringCars = cars.radius;
    this.ringMotos = motos.radius;
    this.cull(env);
    let spawned = 0;
    let tries = 0;
    let nCars = this.pool.count(false);
    let nMotos = this.pool.count(true);
    while (spawned < maxSpawns && tries < maxSpawns * 6 + 20 && (nCars < cars.target || nMotos < motos.target)) {
      tries++;
      const moto = nCars >= cars.target || (nMotos < motos.target && this.rng.chance(intensity.motoShare));
      const r1 = moto ? motos.radius : cars.radius;
      const k = initial ? this.ring.pick(6, r1, this.rng.next())
        : this.ring.pickToward(Math.min(SPAWN_MIN, r1 * 0.6), r1, this.rnd, env.player.pos, this.laneDir);
      if (!k || this.trySpawn(env, k.lane, k.s + this.rng.range(0, SAMPLE_LEN), moto, initial) === null) continue;
      spawned++;
      if (moto) nMotos++;
      else nCars++;
    }
  }

  private cull(env: SpawnEnv): void {
    const limit = STUCK_LIMIT[env.intensity.id] ?? 40;
    for (let i = this.pool.active.length - 1; i >= 0; i--) {
      const v = this.pool.active[i];
      const d = Math.hypot(v.pos.x - env.player.pos.x, v.pos.z - env.player.pos.z);
      const ring = v.isMoto ? this.ringMotos : this.ringCars;
      const seen = this.visible(env, v.pos, v.halfLen);
      const t = this.tracks.get(v.track);
      const atExit = t.lane >= 0 && this.exits.has(t.node) && t.length - v.s < v.halfLen + 6 && d > 60;
      if (d > ring + 120 || (!seen && (d > ring + 35 || atExit))) this.pool.despawn(v);
      else if (v.stuck > limit && !seen && d > 25) {
        this.pool.despawn(v);
        this.unstuck++;
      }
    }
  }

  private trySpawn(env: SpawnEnv, lane: number, s: number, moto: boolean, initial: boolean): Vehicle | null {
    const t = this.tracks.get(lane);
    const spec = moto ? VEHICLES.moto : VEHICLES[pickCarKind(this.weights, this.rng)];
    const half = spec.length / 2;
    if (s < half + 1 || s > t.length - half - 2.5) return null;
    if (spec.kind === 'bus' && this.tracks.city.edges[t.edge].cls === 'soi') return null;
    const v = this.pool.spawn(spec, moto);
    v.track = lane;
    v.s = s;
    temperament(v, env.intensity.id, this.rng);
    paintVehicle(v, this.rng);
    v.lat = v.latTarget = moto ? Math.min(t.width / 2 + 0.2, v.jitter) : laneJitter(v, t.width);
    v.place(this.tracks);
    const near = Math.hypot(v.pos.x - env.player.pos.x, v.pos.z - env.player.pos.z);
    if (near < (initial ? 8 : SPAWN_MIN * 0.6) || (!initial && this.visible(env, v.pos, half + 1)) || this.blocked(v)) {
      this.pool.despawn(v);
      return null;
    }
    const lead = this.leaderGap(v);
    v.speed = Math.min(t.speedLimit * env.intensity.flow * v.v0, Math.sqrt(4 * Math.max(0, lead - 4)), spec.maxSpeed);
    extendRoute(v, this.tracks, this.rng, env.player.pos);
    return v;
  }

  /** would this body (padded lengthwise for a safe headway) touch any live vehicle? */
  private blocked(v: Vehicle): boolean {
    padded.cx = v.obb.cx;
    padded.cz = v.obb.cz;
    padded.hw = v.obb.hw + 0.25;
    padded.hl = v.obb.hl + 3;
    padded.angle = v.obb.angle;
    for (const o of this.pool.active) {
      if (o === v || !obbMayTouch(padded, o.obb)) continue;
      if (obbPenetration(padded, o.obb) > 0) return true;
    }
    return false;
  }

  private leaderGap(v: Vehicle): number {
    let gap = 60;
    for (const o of this.pool.active) {
      if (o === v || o.track !== v.track || o.s <= v.s) continue;
      gap = Math.min(gap, o.s - o.halfLen - v.s - v.halfLen);
    }
    return gap;
  }
}
