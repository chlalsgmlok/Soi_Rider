import { Scene } from 'three';
import { CameraRig } from '../../../camera';
import { Rng } from '../../../core/rng';
import type { CityQuery, DistrictId, Loadout, TimeOfDay, TrafficIntensity } from '../../../core/types';
import type { AssetProgress, Assets } from '../../../engine/assets/assets';
import type { Engine } from '../../../engine/engine';
import { Environment } from '../../../engine/env/environment';
import { riderRigAssetNames } from '../../../player';
import { trafficAssetNames } from '../../../traffic';
import { buildCityView, type CityFrame, cityAssetNames, type CityView, createCityQuery, preloadCityFonts } from '../../../world';
import type { BackdropScene } from '../backdrop';
import { BackdropPost } from '../shared/backdrop-post';
import { PointerParallax } from '../shared/pointer-parallax';
import { StreetLife } from '../shared/street-life';
import { TitleCamera } from './title-camera';
import { TitleHero } from './title-hero';
import { TITLE_SHOT, type TitleShot } from './title-shot';
import { pickTitleSite, titleCityData, type TitleSite } from './title-site';

/** pre-roll until the framed approach has shown red this long (s), giving up after QUEUE_MAX_S */
const QUEUE_RED_S = 9;
const QUEUE_MAX_S = 50;

export interface TitleSceneOptions {
  /** the save's loadout (the hero waiting on the kerb) */
  loadout: Loadout;
  /** default 'sunset' (golden hour); pass the last trip's time of day to follow the save */
  timeOfDay?: TimeOfDay;
  /** default 'rush' */
  intensity?: TrafficIntensity;
  /** seconds of traffic pre-roll (default 8); then it rolls on until the framed approach has queued at a red */
  warmup?: number;
  reducedMotion?: boolean;
  /** dev / tests: another city and site rank instead of the fixed showcase */
  showcase?: { seed: number; district: DistrictId; rank?: number };
  /** art-direction overrides (dev) */
  shot?: Partial<TitleShot>;
}

/**
 * The title backdrop (mockup 03): the showcase district's busiest charming junction at golden hour, living rush-hour
 * traffic with motorbikes filtering through the queues, the player's rider waiting on the kerb inside the gram ring,
 * and a slow cinematic orbit/dolly with a strong miniature tilt-shift and a touch of mouse parallax.
 */
export class TitleScene implements BackdropScene {
  readonly scene = new Scene();
  readonly site: TitleSite;
  private readonly query: CityQuery;
  private readonly env: Environment;
  private readonly city: CityView;
  private readonly life: StreetLife;
  private readonly hero: TitleHero;
  private readonly shot: TitleCamera;
  private readonly rig: CameraRig;
  private readonly parallax = new PointerParallax();
  private readonly ground: number;
  private readonly kerb: number;
  private readonly cityFrame: CityFrame;
  /** city focus (viaduct cut-away) = the orbit target */
  private readonly focus2 = { x: 0, z: 0 };
  /** the hero shot is a poster: a touch richer than the ride grade (mockup 03's saturated, contrasty golden hour) */
  private readonly post = new BackdropPost({ saturation: 1.08, contrast: 0.05, vignette: 0.08 });
  private engine: Engine | null = null;
  private offQuality: (() => void) | null = null;
  private reduced = false;

  /** every model the title needs (city placements, traffic rigs, the hero's rig) */
  static assetNames(showcase?: TitleSceneOptions['showcase']): string[] {
    const city = cityAssetNames(titleCityData(showcase));
    return [...new Set([...city, ...trafficAssetNames(), ...riderRigAssetNames()])];
  }

  /** preload (no-op for what is cached) + sign fonts, then build */
  static async create(engine: Engine, assets: Assets, opts: TitleSceneOptions, onProgress?: AssetProgress): Promise<TitleScene> {
    await Promise.all([preloadCityFonts(), assets.preload(TitleScene.assetNames(opts.showcase), onProgress)]);
    return new TitleScene(engine, assets, opts);
  }

  /** needs `TitleScene.assetNames()` preloaded (and the city fonts for crisp signs) */
  constructor(engine: Engine, assets: Assets, opts: TitleSceneOptions) {
    this.scene.name = 'title_backdrop';
    const data = titleCityData(opts.showcase);
    const rng = new Rng(data.seed);
    const tod = opts.timeOfDay ?? 'sunset';
    const shot = { ...TITLE_SHOT, ...opts.shot };
    this.query = createCityQuery(data);
    this.site = pickTitleSite(this.query, shot, opts.showcase?.rank);
    this.env = new Environment(engine.renderer, engine.quality, tod);
    this.env.attach(this.scene);
    this.env.setWeather({ overcast: 0, rain: 0, haze: 0.06 }, 0);
    this.city = buildCityView(data, { quality: engine.quality, rng: rng.fork('cityview'), assets });
    this.scene.add(this.city.root);

    const { hero, junction } = this.site;
    this.ground = this.city.groundHeight(junction.x, junction.z);
    this.kerb = this.city.groundHeight(hero.x, hero.z);
    this.hero = new TitleHero(assets, opts.loadout, engine.quality, hero, this.site.heading, this.kerb);
    this.scene.add(this.hero.root);

    this.life = StreetLife.create(this.query, assets, engine.quality, rng.fork('title-traffic'), {
      intensity: opts.intensity ?? 'rush', timeOfDay: tod, crowd: 1.6,
    });
    this.scene.add(this.life.view.root);
    this.shot = new TitleCamera(this.site);
    this.rig = new CameraRig(engine.camera);
    this.reducedMotion = opts.reducedMotion ?? false;
    this.shot.update(0, this.rig, this.parallax.value, true, this.ground, this.kerb);
    this.life.aim(engine.camera, engine.quality.drawDistance);
    this.life.warmup(this.hero.state, opts.warmup ?? 8);
    this.queueUp();
    this.cityFrame = {
      night: 0, lamps: 0, wet: 0, camPos: engine.camera.position, focus: this.focus2, signal: this.life.signal,
    };
  }

  /** first impression = a full queue: roll the traffic on until the framed approach has been red for a while */
  private queueUp(): void {
    const { node, edge } = this.site;
    if (node < 0) return;
    let red = 0;
    this.life.settle(this.hero.state, QUEUE_MAX_S, (dt) => (red = this.life.system.lamp(node, edge) === 'red' ? red + dt : 0) >= QUEUE_RED_S);
  }

  set reducedMotion(on: boolean) {
    this.reduced = on;
    this.parallax.enabled = !on;
  }

  /** follow the save's last trip (or any light): blends over `blendSec` */
  setTimeOfDay(tod: TimeOfDay, blendSec = 2.5): void {
    this.env.setTimeOfDay(tod, blendSec);
    this.life.setTimeOfDay(tod);
  }

  /** the hero rider wears the newly equipped loadout */
  setLoadout(loadout: Loadout): void {
    this.hero.setLoadout(loadout);
  }

  enter(engine: Engine): void {
    this.engine = engine;
    engine.setScene(this.scene);
    this.env.setQuality(engine.quality);
    this.offQuality?.();
    this.offQuality = engine.onQualityChange((q) => {
      this.env.setQuality(q);
      this.hero.setQuality(q);
    });
    this.parallax.attach();
    this.post.snap();
  }

  update(dt: number): void {
    const e = this.engine;
    if (!e) return;
    this.parallax.update(dt);
    const cam = this.shot.update(dt, this.rig, this.parallax.value, this.reduced, this.ground, this.kerb);
    const env = this.env;
    const target = this.shot.target;
    env.update(dt, target);
    this.focus2.x = target.x;
    this.focus2.z = target.z;
    this.hero.update(dt, env.lampsOn, env.night, this.reduced);
    this.life.update(this.hero.state, {
      camera: e.camera, dt, night: env.night, lamps: env.lampsOn, rain: env.weather.rain,
      groundHeight: this.city.groundHeight, drawDistance: e.quality.drawDistance,
    });
    this.cityFrame.night = env.night;
    this.cityFrame.lamps = env.lampsOn;
    this.city.update(dt, this.cityFrame);
    this.post.apply(e, env.grade(), cam);
  }

  exit(): void {
    this.offQuality?.();
    this.offQuality = null;
    this.parallax.detach();
    this.engine = null;
  }

  /** agents on screen for perf HUDs */
  stats(): { cars: number; motos: number; pedestrians: number; overlaps: number } {
    return this.life.system.stats();
  }

  dispose(): void {
    this.exit();
    this.life.dispose();
    this.hero.dispose();
    this.city.root.removeFromParent();
    this.city.dispose();
    this.env.dispose();
    this.scene.clear();
  }
}
