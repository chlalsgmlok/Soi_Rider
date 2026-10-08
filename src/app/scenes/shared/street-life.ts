import type { Camera } from 'three';
import type { Rng } from '../../../core/rng';
import type { CityQuery, SignalView, TimeOfDay, TrafficIntensity } from '../../../core/types';
import type { Assets } from '../../../engine/assets/assets';
import type { QualitySettings } from '../../../engine/quality';
import { CameraProbe, capsFor, type TrafficPlayer, TrafficSystem, TrafficView } from '../../../traffic';

const STEP = 1 / 60;
const MAX_STEPS = 4;

/** what the traffic visuals need from the backdrop each frame */
export interface StreetFrame {
  camera: Camera;
  /** real seconds since the last frame */
  dt: number;
  night: number;
  lamps: number;
  rain: number;
  groundHeight(x: number, z: number): number;
  /** QualitySettings.drawDistance (spawn probe range) */
  drawDistance: number;
}

/** an existing simulation + view (e.g. the run's GameSession) for a backdrop to drive */
export interface StreetLifeParts {
  system: TrafficSystem;
  view: TrafficView;
  intensity: TrafficIntensity;
  /** the session's probe; the backdrop keeps it aimed with the engine camera (none → spawns are not hidden) */
  probe?: CameraProbe;
}

/**
 * Living traffic behind a menu: steps a TrafficSystem in ≤ 1/60 s sub-steps from the frame dt (stable at any refresh
 * rate), keeps a CameraProbe aimed so agents never pop in on screen, and draws everything through a TrafficView.
 * `create` builds and owns its own (title); `wrap` drives a session's without taking ownership (intro).
 */
export class StreetLife {
  /** CityFrame.signal for the city view (live junction lamps) */
  readonly signal = (node: number): SignalView | null => this.system.signal(node);

  private constructor(
    readonly system: TrafficSystem,
    readonly view: TrafficView,
    private readonly probe: CameraProbe | null,
    private readonly owned: boolean,
    public intensity: TrafficIntensity,
  ) {}

  /**
   * A silent (no bus events) simulation sized from the quality hints, dense around `player` (see RingBudget);
   * `crowd` multiplies the walkers on the pavements.
   */
  static create(
    query: CityQuery, assets: Assets, quality: QualitySettings, rng: Rng,
    opts: { intensity: TrafficIntensity; timeOfDay: TimeOfDay; crowd?: number },
  ): StreetLife {
    const system = new TrafficSystem(query, rng, {
      intensity: opts.intensity, bus: null, conditions: { timeOfDay: opts.timeOfDay, rain: 0 },
      caps: { ...capsFor(quality, opts.intensity), crowd: opts.crowd ?? 1 },
    });
    const probe = new CameraProbe(query);
    system.setViewProbe(probe);
    return new StreetLife(system, new TrafficView(assets, query, { bus: null }), probe, true, opts.intensity);
  }

  static wrap(parts: StreetLifeParts): StreetLife {
    return new StreetLife(parts.system, parts.view, parts.probe ?? null, false, parts.intensity);
  }

  setTimeOfDay(tod: TimeOfDay): void {
    this.system.setConditions({ timeOfDay: tod });
  }

  /** aim the spawn probe at what `camera` sees (call after moving the camera, before a warmup) */
  aim(camera: Camera, drawDistance: number): void {
    this.probe?.update(camera, drawDistance);
  }

  /** fill the spawn ring and let queues form before the first frame (owned simulations only; aim first) */
  warmup(player: TrafficPlayer, seconds: number): void {
    if (this.owned && seconds > 0) this.system.warmup(player, seconds, this.intensity);
  }

  /** keep stepping (≤ `maxSeconds`, owned only) until `ready(dt)` says the street looks right, e.g. a queue at red */
  settle(player: TrafficPlayer, maxSeconds: number, ready: (dt: number) => boolean): void {
    if (!this.owned) return;
    const dt = 1 / 30;
    for (let t = 0; t < maxSeconds; t += dt) {
      this.system.update(dt, player, this.intensity);
      if (ready(dt)) return;
    }
  }

  update(player: TrafficPlayer, f: StreetFrame): void {
    this.aim(f.camera, f.drawDistance);
    const span = Math.min(f.dt, STEP * MAX_STEPS);
    const n = Math.max(1, Math.ceil(span / STEP - 1e-6));
    for (let i = 0; i < n; i++) this.system.update(span / n, player, this.intensity);
    this.view.update(this.system, {
      camera: f.camera, dt: f.dt, night: f.night, lamps: f.lamps, rain: f.rain, groundHeight: f.groundHeight,
    });
  }

  dispose(): void {
    if (!this.owned) return;
    this.view.root.removeFromParent();
    this.view.dispose();
    this.system.dispose();
  }
}
