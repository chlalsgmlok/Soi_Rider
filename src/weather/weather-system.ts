import { Group, type Object3D, type PerspectiveCamera } from 'three';
import { bus as globalBus, type EventBus } from '../core/events';
import { clamp, smoothstep } from '../core/math2d';
import type { Rng } from '../core/rng';
import type { Circle, TrafficQuery, Vec2, WeatherEvent, WeatherPlan } from '../core/types';
import type { Environment } from '../engine/env/environment';
import type { QualitySettings } from '../engine/quality';
import { fxBudget } from './fx/fx-budget';
import { FrameBuilder } from './fx/frame-builder';
import { HazeFx } from './fx/haze/haze-fx';
import { RainFx } from './fx/rain/rain-fx';
import type { SpraySource } from './fx/rain/spray';
import { SkyFlash } from './fx/sky-flash';
import { WetGloss } from './fx/wet/wet-gloss';
import { WetReflections } from './fx/wet/wet-reflections';
import { WeatherTimeline } from './timeline/weather-timeline';
import type { WeatherState } from './types';

/** what the weather needs from the city view (CityView fits) */
export interface WeatherCity {
  readonly root: Object3D;
  readonly puddleSpots: readonly Circle[];
  groundHeight(x: number, z: number): number;
}

/** the rider: wheel spray + puddle splashes (PlayerState fits) */
export type WeatherRider = SpraySource;

export interface WeatherCtx {
  env: Environment;
  /** the FX root is added here */
  scene: Object3D;
  camera: PerspectiveCamera;
  quality: QualitySettings;
  /** e.g. runRng.fork('weather') */
  rng: Rng;
  /** default: the app bus */
  bus?: EventBus;
  city?: WeatherCity | null;
  /** NPC tyre spray, pedestrians soaked by puddle splashes */
  traffic?: TrafficQuery | null;
  /** TrafficView: its lamp flares get wet-road reflections, its paint gets wet */
  trafficView?: { readonly root: Object3D } | null;
  rider?: WeatherRider | null;
  /** more roots whose standard materials turn glossy in the rain (the RiderRig root) */
  glossy?: readonly Object3D[];
}

const TRIGGER_DEFAULTS: Record<WeatherEvent['kind'], { duration: number; intensity: number }> = {
  downpour: { duration: 90, intensity: 0.9 },
  haze_spike: { duration: 40, intensity: 0.85 },
};

/**
 * The run's weather (docs/ARCHITECTURE.md › weather): the WeatherTimeline drives Environment.setWeather and the
 * bus ('weather:change', 'thunder', 'splash'); RainFx / HazeFx / wet reflections / wet paint / lightning present it.
 * PLAY frame step 5: `update(dt, tripProgress)` BEFORE Environment.update; feed `state.wetness` to
 * CityView.update({ wet }) and tyre grip, and `lensWet(pov)` to PostFx `wet`.
 */
export class WeatherSystem {
  readonly timeline: WeatherTimeline;
  readonly root = new Group();
  readonly rainFx: RainFx;
  readonly hazeFx: HazeFx;
  readonly reflections = new WetReflections();
  readonly gloss = new WetGloss();
  /** false hides every FX (perf A/B); the timeline, Environment and bus keep running */
  fxEnabled = true;
  private readonly flash = new SkyFlash();
  private readonly frames: FrameBuilder;
  private readonly env: Environment;
  private quality: QualitySettings;
  private rider: WeatherRider | null = null;
  private dropRider: (() => void) | null = null;
  private readonly traffic: TrafficQuery | null;
  private strikesSeen = 0;
  private lastDt = 1 / 60;

  constructor(plan: WeatherPlan, ctx: WeatherCtx) {
    const bus = ctx.bus ?? globalBus;
    this.env = ctx.env;
    this.quality = ctx.quality;
    this.traffic = ctx.traffic ?? null;
    this.timeline = new WeatherTimeline(plan, ctx.rng.fork('timeline'), bus);
    const budget = fxBudget(ctx.quality);
    const fx = ctx.rng.fork('fx');
    const city = ctx.city ?? null;
    const ground = city ? (x: number, z: number): number => city.groundHeight(x, z) : (): number => 0;
    this.frames = new FrameBuilder(ctx.camera, this.timeline.state, ground);
    this.rainFx = new RainFx(budget, fx.fork('rain'), bus, city?.puddleSpots ?? []);
    this.rainFx.spray.track(this.traffic);
    this.hazeFx = new HazeFx(budget, fx.fork('haze'), ground);
    if (city && budget.reflections) this.reflections.addPools(city.root);
    if (ctx.trafficView) {
      if (budget.reflections) this.reflections.addFlares(ctx.trafficView.root);
      this.gloss.add(ctx.trafficView.root);
    }
    for (const r of ctx.glossy ?? []) this.gloss.add(r);
    this.root.name = 'weather';
    this.root.add(this.rainFx.root, this.hazeFx.root, this.reflections.root, this.flash.root);
    ctx.scene.add(this.root);
    this.setRider(ctx.rider ?? null);
    this.applyEnv(0);
  }

  get state(): Readonly<WeatherState> {
    return this.timeline.state;
  }

  /** road wetness 0..1 (CityView wet, gripFor) */
  get wetness(): number {
    return this.timeline.state.wetness;
  }

  /** the rider whose tyres spray and splash (null in cut-scenes) */
  setRider(rider: WeatherRider | null): void {
    this.dropRider?.();
    this.rider = rider;
    this.dropRider = rider ? this.rainFx.spray.register(rider) : null;
  }

  /** advance the weather; `tripProgress` 0..1 of the route to the dropoff (events start at their atProgress) */
  update(dt: number, tripProgress: number): void {
    this.lastDt = dt;
    const env = this.env;
    this.timeline.update(dt, clamp(tripProgress, 0, 1), 1 - env.night);
    this.applyEnv(0);
    const s = this.timeline.state;
    if (this.timeline.strikes !== this.strikesSeen) {
      this.strikesSeen = this.timeline.strikes;
      this.flash.aim(this.timeline.time * 2.399 + this.strikesSeen * 1.7, this.strikesSeen);
    }
    this.root.visible = this.fxEnabled;
    if (!this.fxEnabled) return;
    const f = this.frames.update(dt, env, this.rider, Math.min(globalThis.devicePixelRatio || 1, this.quality.pixelRatio));
    const sunlit = (1 - env.night) * (1 - 0.7 * s.overcast) * smoothstep(0.05, 0.3, f.light.sunDir.y);
    this.rainFx.update(f, this.rider, this.traffic, sunlit);
    this.hazeFx.update(f);
    this.reflections.update(s.wetness);
    this.gloss.set(s.wetness);
    this.flash.update(s.lightning, clamp(env.night + 0.5 * s.overcast, 0, 1));
  }

  /** start a downpour / smog spike now (debug keys, sandboxes); false while one of that kind is running */
  trigger(kind: WeatherEvent['kind'], opts: Partial<{ duration: number; intensity: number }> = {}): boolean {
    const d = TRIGGER_DEFAULTS[kind];
    return this.timeline.trigger(kind, opts.duration ?? d.duration, opts.intensity ?? d.intensity);
  }

  /** a lightning strike now (debug) */
  strike(km?: number): void {
    this.timeline.strike(km);
  }

  /** bus / truck / tuk-tuk soot (wire TrafficSystem.onExhaust here); `heading` = direction the smoke leaves along */
  emitExhaust(pos: Vec2, heading: number, strength = 1): void {
    if (this.fxEnabled) this.hazeFx.emitExhaust(pos, heading, strength);
  }

  /** PostFx `wet`: lens drops while the POV camera is active (they linger a moment after the rain) */
  lensWet(pov: boolean): number {
    return this.rainFx.lensWet(this.lastDt, this.timeline.state.rain, pov);
  }

  setQuality(q: QualitySettings): void {
    this.quality = q;
    const b = fxBudget(q);
    this.rainFx.setBudget(b);
    this.hazeFx.setBudget(b);
  }

  /** remove every FX, restore patched materials and calm the Environment's weather */
  dispose(): void {
    this.dropRider?.();
    this.rainFx.dispose();
    this.hazeFx.dispose();
    this.reflections.dispose();
    this.gloss.dispose();
    this.flash.dispose();
    this.root.removeFromParent();
    this.env.setWeather({ overcast: 0, rain: 0, haze: 0 }, 1.5);
  }

  private applyEnv(blend: number): void {
    const s = this.timeline.state;
    // the Environment's "rain" is the storm LOOK (slate sky, lamps on): it leads the drops during the build-up
    this.env.setWeather({ overcast: s.overcast, rain: s.gloom, haze: s.haze }, blend);
  }
}
