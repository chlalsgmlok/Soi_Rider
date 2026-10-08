import { type Camera, Frustum, Matrix4, Vector3 } from 'three';
import { bus as globalBus, type EventBus } from '../../core/events';
import { type CityQuery, Surface } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import type { Vehicle } from '../sim/vehicle';
import type { TrafficSystem } from '../traffic-system';
import { AgentFxTable } from './agent-fx';
import type { DrawFrame } from './draw-frame';
import { MirrorFolds } from './mirror-folds';
import { PedDrawer } from './ped-drawer';
import { type RigCaps, RigSet } from './rig-set';
import { VehicleDrawer } from './vehicle-drawer';

export interface TrafficViewOptions {
  /** collision events (mirror folds); default the app bus */
  bus?: EventBus | null;
  /** instance capacity per rig */
  caps?: Partial<RigCaps>;
}

export interface TrafficViewFrame {
  camera: Camera;
  dt: number;
  /** Environment.night */
  night: number;
  /** Environment.lampsOn (defaults to night) */
  lamps?: number;
  /** 0..1 rain (ponchos) */
  rain: number;
  /** CityView.groundHeight — sidewalks, medians, speed humps; a surface-based fallback is used without it */
  groundHeight?: (x: number, z: number) => number;
}

export interface TrafficViewStats {
  vehiclesDrawn: number;
  peopleDrawn: number;
  /** characters incl. drivers and riders */
  characters: number;
}

/** sidewalk / median heights of src/world/build (kit/dims HEIGHTS) for the fallback ground */
const FALLBACK_Y: Record<number, number> = { [Surface.Sidewalk]: 0.15, [Surface.Plaza]: 0.06, [Surface.Median]: 0.22 };
const vp = new Matrix4();
const cam = new Vector3();

/**
 * Visuals for the whole traffic simulation: instanced rigs for every vehicle model, the shared character rig
 * (pedestrians, riders, drivers), lamp flares and headlight fans. Add `root` to the scene and call `update` once
 * per rendered frame after the simulation step.
 */
export class TrafficView {
  readonly rigs: RigSet;
  private readonly fx = new AgentFxTable();
  private readonly vehicles: VehicleDrawer;
  private readonly people: PedDrawer;
  private readonly folds: MirrorFolds;
  private readonly frustum = new Frustum();
  private time = 0;
  private readonly statsOut: TrafficViewStats = { vehiclesDrawn: 0, peopleDrawn: 0, characters: 0 };
  private readonly frame: DrawFrame;

  constructor(assets: Assets, private readonly city: CityQuery, opts: TrafficViewOptions = {}) {
    this.rigs = new RigSet(assets, { cars: 96, motos: 160, characters: 480, ...opts.caps });
    this.vehicles = new VehicleDrawer(this.rigs, this.fx);
    this.people = new PedDrawer(this.rigs);
    this.folds = new MirrorFolds(opts.bus === undefined ? globalBus : opts.bus);
    const fallback = (x: number, z: number): number => FALLBACK_Y[this.city.surfaceAt(x, z)] ?? 0;
    this.frame = {
      dt: 0, time: 0, night: 0, lamps: 0, rain: 0, camX: 0, camY: 0, camZ: 0, frustum: this.frustum, ground: fallback,
    };
  }

  get root(): RigSet['root'] {
    return this.rigs.root;
  }

  /** `extras`: vehicles outside the simulation drawn with the NPC rigs (sandbox rider marker, cut-scene props) */
  update(sys: TrafficSystem, f: TrafficViewFrame, extras?: readonly Vehicle[]): void {
    this.time += f.dt;
    f.camera.updateMatrixWorld();
    vp.multiplyMatrices(f.camera.projectionMatrix, f.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(vp);
    cam.setFromMatrixPosition(f.camera.matrixWorld);
    const d = this.frame;
    d.dt = f.dt;
    d.time = this.time;
    d.night = f.night;
    d.lamps = f.lamps ?? f.night;
    d.rain = f.rain;
    d.camX = cam.x;
    d.camY = cam.y;
    d.camZ = cam.z;
    if (f.groundHeight) d.ground = f.groundHeight;
    this.fx.begin();
    this.folds.apply((id) => sys.core.pool.get(id), this.fx);
    this.rigs.begin();
    this.statsOut.vehiclesDrawn = this.vehicles.draw(sys.vehicles(), d) + (extras ? this.vehicles.draw(extras, d) : 0);
    this.statsOut.peopleDrawn = this.people.draw(sys.peds.active, d);
    this.statsOut.characters = this.rigs.people.count;
    this.rigs.commit();
    this.fx.sweep();
  }

  stats(): Readonly<TrafficViewStats> {
    return this.statsOut;
  }

  dispose(): void {
    this.folds.dispose();
    this.rigs.dispose();
  }
}
