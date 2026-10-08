import type { EventBus } from '../../core/events';
import type { Rng } from '../../core/rng';
import type { CityQuery, TrafficIntensity } from '../../core/types';
import { INTENSITY } from '../../core/config/traffic';
import { buildConflicts } from './conflicts';
import { CorridorScanner } from './corridor';
import type { DriveCtx } from './drive-ctx';
import { JunctionGate } from './junction-gate';
import { LaneLists } from './lane-lists';
import { Obstacles } from './obstacles';
import { SignalBank } from './signals';
import { Spawner } from './spawner';
import { Tracks } from './tracks';
import { carWeights } from './vehicle-mix';
import { VehiclePool } from './vehicle-pool';

/**
 * The vehicle simulation's moving parts, wired once per city: track graph, conflict table, signals, junction
 * gate, per-lane lists, obstacle grid, corridor scanner, vehicle pool, spawner and the shared drive context.
 */
export class TrafficCore {
  readonly tracks: Tracks;
  readonly signals: SignalBank;
  readonly lists: LaneLists;
  readonly obstacles: Obstacles;
  readonly gate: JunctionGate;
  readonly pool: VehiclePool;
  readonly spawner: Spawner;
  readonly ctx: DriveCtx;

  constructor(readonly city: CityQuery, rng: Rng, intensity: TrafficIntensity, bus: EventBus | null) {
    const data = city.data;
    const cfg = INTENSITY[intensity];
    this.tracks = new Tracks(data);
    this.signals = new SignalBank(data, rng.fork('signals'), cfg.signalCycle);
    this.lists = new LaneLists(this.tracks);
    this.obstacles = new Obstacles(data.bounds);
    this.gate = new JunctionGate(data, this.tracks, buildConflicts(data), this.signals, this.lists, this.obstacles);
    this.pool = new VehiclePool(this.gate);
    this.spawner = new Spawner(this.tracks, this.pool, rng.fork('spawn'), carWeights(data.district, intensity));
    this.ctx = {
      tracks: this.tracks, gate: this.gate, scanner: new CorridorScanner(this.tracks, this.obstacles), lists: this.lists,
      obstacles: this.obstacles, rng: rng.fork('drive'), bus, flow: cfg.flow, dt: 1 / 60, focus: { x: 0, z: 0 },
      playerIndex: -1, onExhaust: null,
    };
  }

  setIntensity(intensity: TrafficIntensity): void {
    const cfg = INTENSITY[intensity];
    this.signals.setCycle(cfg.signalCycle);
    this.ctx.flow = cfg.flow;
    this.spawner.setWeights(carWeights(this.city.data.district, intensity));
  }

  /** snapshot every vehicle into the obstacle grid (indices = pool order) and the per-lane lists */
  snapshotVehicles(): void {
    const ob = this.obstacles;
    ob.begin();
    for (const v of this.pool.active) ob.add('vehicle', ob.count, v.obb.cx, v.obb.cz, v.obb.angle, v.halfW, v.halfLen, v.speed);
    this.lists.rebuild(this.pool.active);
  }
}
