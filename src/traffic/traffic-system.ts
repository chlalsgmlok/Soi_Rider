import { bus as globalBus } from '../core/events';
import { INTENSITY } from '../core/config/traffic';
import type { Rng } from '../core/rng';
import type {
  CityQuery, PedestrianView, SignalView, TrafficAgentView, TrafficIntensity, TrafficQuery, Vec2,
} from '../core/types';
import type { PedEnv } from './peds/ped-spawner';
import { Pedestrians } from './peds/pedestrians';
import { driveCar } from './sim/car-driver';
import { driveMoto } from './sim/moto-driver';
import { auditOverlaps, type OverlapReport } from './sim/overlap-audit';
import type { LampState } from './sim/signal-plan';
import { TrafficCore } from './sim/traffic-core';
import {
  type ExhaustPuff, PED_ID_BASE, type PedScare, type TrafficCaps, type TrafficConditions, type TrafficPlayer,
  type TrafficStats, type ViewProbe,
} from './sim/types';
import type { Vehicle } from './sim/vehicle';
import { agentsNear, shoveVehicle } from './sim/vehicle-shove';
import { motoBudget, type TrafficOptions } from './traffic-options';

/**
 * Bangkok's living traffic on top of a CityQuery: signals, NPC cars (IDM, lanes, junction gates, lane changes,
 * horns), filtering motorbikes and pedestrians, spawned in a ring around the rider. Pure simulation — no three.js;
 * `TrafficView` draws it. Call `update` in the fixed step after the bike physics.
 */
export class TrafficSystem implements TrafficQuery {
  readonly core: TrafficCore;
  readonly peds: Pedestrians;
  onPedScare: ((e: PedScare) => void) | null = null;
  private intensity: TrafficIntensity;
  private caps: TrafficCaps;
  private conditions: TrafficConditions;
  private probe: ViewProbe | null = null;
  private readonly audit: boolean;
  private readonly report: OverlapReport = { count: 0, max: 0, a: -1, b: -1 };
  private readonly statsOut: TrafficStats = {
    cars: 0, motos: 0, pedestrians: 0, avgSpeed: 0, overlaps: 0, maxOverlap: 0, unstuck: 0, ringRadius: 0, stepMs: 0,
  };
  private populated = false;
  private readonly envObj: PedEnv;
  /** the motorbike budget follows the intensity's motoShare unless the caller fixed it */
  private readonly autoMotos: boolean;

  constructor(readonly city: CityQuery, rng: Rng, opts: TrafficOptions = {}) {
    this.intensity = opts.intensity ?? 'rush';
    const cars = opts.caps?.cars ?? 48;
    this.caps = { cars, motos: opts.caps?.motos ?? motoBudget(cars, this.intensity), pedestrians: opts.caps?.pedestrians ?? 34 };
    this.autoMotos = opts.caps?.motos === undefined;
    this.conditions = opts.conditions ?? { timeOfDay: 'noon', rain: 0 };
    this.audit = opts.audit ?? false;
    const root = rng.fork('traffic');
    this.core = new TrafficCore(city, root, this.intensity, opts.bus === undefined ? globalBus : opts.bus);
    this.peds = new Pedestrians(city, this.core.signals, this.core.obstacles, root.fork('peds'));
    this.peds.onScare = (e) => this.onPedScare?.(e);
    this.envObj = {
      player: { pos: { x: 0, z: 0 }, heading: 0, speed: 0, obb: { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 } },
      probe: null, caps: this.caps, intensity: INTENSITY[this.intensity], conditions: this.conditions,
    };
  }

  set onExhaust(fn: ((e: ExhaustPuff) => void) | null) {
    this.core.ctx.onExhaust = fn;
  }

  setViewProbe(probe: ViewProbe | null): void {
    this.probe = probe;
  }

  setCaps(caps: Partial<TrafficCaps>): void {
    Object.assign(this.caps, caps);
  }

  setConditions(c: Partial<TrafficConditions>): void {
    Object.assign(this.conditions, c);
  }

  /** fill the ring and let queues form for `seconds` before the first frame is shown */
  warmup(player: TrafficPlayer, seconds: number, intensity: TrafficIntensity = this.intensity): void {
    const dt = 1 / 30;
    for (let t = 0; t < seconds; t += dt) this.update(dt, player, intensity);
  }

  update(dt: number, player: TrafficPlayer, intensity: TrafficIntensity): void {
    const t0 = performance.now();
    if (intensity !== this.intensity) {
      this.intensity = intensity;
      this.core.setIntensity(intensity);
      if (this.autoMotos) this.caps.motos = motoBudget(this.caps.cars, intensity);
    }
    const core = this.core;
    const ctx = core.ctx;
    ctx.dt = dt;
    ctx.focus.x = player.pos.x;
    ctx.focus.z = player.pos.z;
    const env = this.env(player);
    if (!this.populated) {
      this.populated = true;
      core.spawner.populate(env);
      this.peds.populate(env);
    }
    core.snapshotVehicles();
    this.peds.addObstacles(core.obstacles);
    const o = player.obb;
    ctx.playerIndex = core.obstacles.add('player', -1, o.cx, o.cz, o.angle, o.hw, o.hl, player.speed);
    core.obstacles.build();
    core.signals.update(dt);
    const list = core.pool.active;
    for (let i = 0; i < list.length; i++) {
      if (list[i].isMoto) driveMoto(list[i], i, ctx);
      else driveCar(list[i], i, ctx);
    }
    this.peds.update(dt, env);
    core.spawner.update(dt, env);
    if (this.audit) auditOverlaps(list, this.report);
    this.statsOut.stepMs = performance.now() - t0;
  }

  private env(player: TrafficPlayer): PedEnv {
    const e = this.envObj;
    e.player = player;
    e.probe = this.probe;
    e.intensity = INTENSITY[this.intensity];
    return e;
  }

  stats(): TrafficStats {
    const s = this.statsOut;
    const list = this.core.pool.active;
    let sum = 0;
    for (const v of list) sum += v.speed;
    s.cars = this.core.pool.count(false);
    s.motos = list.length - s.cars;
    s.pedestrians = this.peds.active.length;
    s.avgSpeed = list.length > 0 ? sum / list.length : 0;
    if (!this.audit) auditOverlaps(list, this.report);
    s.overlaps = this.report.count;
    s.maxOverlap = this.report.max;
    s.unstuck = this.core.spawner.unstuck;
    s.ringRadius = this.core.spawner.ringCars;
    return s;
  }

  /** last overlap audit (deepest pair ids) */
  overlapReport(): Readonly<OverlapReport> {
    return this.report;
  }

  vehicles(): readonly Vehicle[] {
    return this.core.pool.active;
  }

  agents(): readonly TrafficAgentView[] {
    return this.core.pool.active;
  }

  near(p: Vec2, r: number, out: TrafficAgentView[]): number {
    return agentsNear<TrafficAgentView>(this.core.pool.active, p, r, out);
  }

  pedestrians(): readonly PedestrianView[] {
    return this.peds.views();
  }

  signal(nodeId: number): SignalView | null {
    return this.core.signals.view(nodeId);
  }

  /** lamp shown to traffic arriving at `node` along `edge` (city view lamp heads) */
  lamp(node: number, edge: number): LampState {
    return this.core.signals.lamp(node, edge);
  }

  nudge(id: number, impulse: Vec2): void {
    if (id >= PED_ID_BASE) this.peds.nudge(id, impulse.x, impulse.z);
    else {
      const v = this.core.pool.get(id);
      if (v) shoveVehicle(v, impulse);
    }
  }

  /** remove every agent (next update repopulates) */
  reset(): void {
    this.core.pool.clear();
    for (const p of [...this.peds.active]) this.peds.pool.despawn(p);
    this.populated = false;
  }

  dispose(): void {
    this.reset();
    this.onPedScare = null;
    this.core.ctx.onExhaust = null;
  }
}
