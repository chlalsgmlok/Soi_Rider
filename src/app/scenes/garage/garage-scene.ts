import { Scene, Vector3 } from 'three';
import { type Loadout, Surface } from '../../../core/types';
import type { AssetProgress, Assets } from '../../../engine/assets/assets';
import type { Engine } from '../../../engine/engine';
import { Environment } from '../../../engine/env/environment';
import { riderRigAssetNames } from '../../../player';
import { preloadCityFonts } from '../../../world';
import type { BackdropScene } from '../backdrop';
import { BackdropPost } from '../shared/backdrop-post';
import { IdleRider } from '../shared/idle-rider';
import { PointerParallax } from '../shared/pointer-parallax';
import { EquipBounce } from './equip-bounce';
import { GarageCamera } from './garage-camera';
import { buildGarageGround, STREET } from './garage-ground';
import { GarageLights } from './garage-lights';
import { buildGarageStreet, GARAGE_SET_ASSETS } from './garage-street';
import { NeonSign } from './neon-sign';
import { Turntable } from './turntable';

export interface GarageSceneOptions {
  /** the equipped loadout (preview changes go through applyLoadout) */
  loadout: Loadout;
  reducedMotion?: boolean;
}

/** the bike faces three-quarters toward the camera and into the frame (toward the garage panel) */
const HERO_HEADING = 0.75;
/** turntable centre on the pavement in front of the half-open shutter */
const STAGE = new Vector3(0, STREET.curbH, 2.05);
/** neon hanging under the awning, left of the shutter's centre */
const NEON_AT = new Vector3(-0.95, 2.28, 1.38);

const loadoutKey = (l: Loadout): string =>
  [l.bike, l.bikeColor, l.helmet, l.helmetColor, l.outfit, l.outfitColor, l.gear, l.gearColor].join('|');

/**
 * The garage backdrop: the rider's bike + rider on a showroom turntable in front of a half-open shophouse shutter at
 * night — bare bulb, neon, potted plants, the win vest on its hook, warm bounce off the pavement. Framed so the bike
 * sits centred left of the right-docked garage panel. `rotate(delta)` spins the turntable; `applyLoadout` re-dresses
 * live with a little equip hop + LED flash.
 */
export class GarageScene implements BackdropScene {
  readonly scene = new Scene();
  private readonly env: Environment;
  private readonly ground = buildGarageGround();
  private readonly street: ReturnType<typeof buildGarageStreet>;
  private readonly neon = new NeonSign();
  private readonly lights: GarageLights;
  private readonly turntable = new Turntable(HERO_HEADING);
  private readonly rider: IdleRider;
  private readonly bounce = new EquipBounce();
  private readonly cam = new GarageCamera();
  private readonly parallax = new PointerParallax();
  private readonly post = new BackdropPost({ bloomThreshold: 2.4, vignette: 0.08, exposure: 0.92 });
  private engine: Engine | null = null;
  private offQuality: (() => void) | null = null;
  private reduced = false;
  private key: string;
  private time = 0;

  static assetNames(): string[] {
    return [...new Set([...riderRigAssetNames(), ...GARAGE_SET_ASSETS])];
  }

  /** preload (no-op for what is cached) + the neon's Thai font, then build */
  static async create(engine: Engine, assets: Assets, opts: GarageSceneOptions, onProgress?: AssetProgress): Promise<GarageScene> {
    await Promise.all([preloadCityFonts(), assets.preload(GarageScene.assetNames(), onProgress)]);
    return new GarageScene(engine, assets, opts);
  }

  /** needs `GarageScene.assetNames()` preloaded (and Kanit loaded for the neon) */
  constructor(engine: Engine, assets: Assets, opts: GarageSceneOptions) {
    this.scene.name = 'garage_backdrop';
    this.env = new Environment(engine.renderer, engine.quality, 'night');
    this.env.attach(this.scene);
    this.env.setWeather({ overcast: 0.25, rain: 0, haze: 0.1 }, 0);
    this.street = buildGarageStreet(assets);
    this.neon.root.position.copy(NEON_AT);
    this.lights = new GarageLights(engine.quality, STAGE, NEON_AT);
    this.turntable.root.position.copy(STAGE);
    this.rider = new IdleRider(assets, opts.loadout, engine.quality);
    this.rider.place({ x: STAGE.x, z: STAGE.z }, HERO_HEADING, Surface.Sidewalk, STAGE.y + this.turntable.top);
    this.key = loadoutKey(opts.loadout);
    this.reducedMotion = opts.reducedMotion ?? false;
    this.scene.add(this.ground.root, this.street.root, this.neon.root, this.lights.root, this.turntable.root, this.rider.root);
  }

  set reducedMotion(on: boolean) {
    this.reduced = on;
    this.parallax.enabled = !on;
  }

  /** turntable drag (radians, + = dragged right) — GarageProps.onRotate */
  rotate(delta: number): void {
    this.turntable.rotate(delta);
  }

  /** live preview / equip (GarageProps.onPreview): re-dress with an equip hop; unchanged loadouts are ignored */
  applyLoadout(loadout: Loadout): void {
    const key = loadoutKey(loadout);
    if (key === this.key) return;
    this.key = key;
    this.rider.setLoadout(loadout);
    this.turntable.pulse();
    if (!this.reduced) this.bounce.start();
  }

  enter(engine: Engine): void {
    this.engine = engine;
    engine.setScene(this.scene);
    this.env.setQuality(engine.quality);
    this.offQuality?.();
    this.offQuality = engine.onQualityChange((q) => {
      this.env.setQuality(q);
      this.lights.setQuality(q);
      this.rider.rig.setQuality(q);
    });
    this.parallax.attach();
    this.post.snap();
  }

  update(dt: number): void {
    const e = this.engine;
    if (!e) return;
    this.time += dt;
    this.parallax.update(dt);
    const cam = this.cam.update(dt, e.camera, STAGE, this.parallax.value, this.reduced);
    const env = this.env;
    env.update(dt, STAGE);
    this.turntable.update(dt, this.reduced);
    const hop = this.bounce.update(dt);
    this.rider.lift = hop.lift;
    this.rider.setHeading(this.turntable.heading);
    this.rider.update(dt, env.lampsOn, env.night);
    this.rider.root.scale.set(hop.sxz, hop.sy, hop.sxz);
    this.neon.update(dt, this.reduced);
    this.lights.update(this.time, this.neon.level, this.reduced);
    this.post.apply(e, env.grade(), cam);
  }

  exit(): void {
    this.offQuality?.();
    this.offQuality = null;
    this.parallax.detach();
    this.engine = null;
  }

  dispose(): void {
    this.exit();
    this.rider.dispose();
    this.turntable.dispose();
    this.lights.dispose();
    this.neon.dispose();
    this.street.dispose();
    this.ground.dispose();
    this.env.dispose();
    this.scene.clear();
  }
}
