import { Scene, Vector3 } from 'three';
import { CameraRig } from '../../../camera';
import { headingOf, wrapAngle } from '../../../core/math2d';
import type { CityData, CityQuery, Loadout } from '../../../core/types';
import type { Assets } from '../../../engine/assets/assets';
import type { Engine } from '../../../engine/engine';
import type { Environment } from '../../../engine/env/environment';
import { riderRigAssetNames, type RiderRig } from '../../../player';
import type { CityFrame, CityView } from '../../../world';
import type { BackdropScene } from '../backdrop';
import { BackdropPost } from '../shared/backdrop-post';
import { IdleRider } from '../shared/idle-rider';
import { PointerParallax } from '../shared/pointer-parallax';
import { Sightlines } from '../shared/sightlines';
import { StreetLife, type StreetLifeParts } from '../shared/street-life';
import { AuntLek } from './aunt-lek';
import { IntroCamera } from './intro-camera';
import { findStandSite, type StandSite } from './stand-site';

export interface IntroSceneOptions {
  /** the run's city, built by the session (its root is added to `scene` if not already there) */
  city: CityView;
  query: CityQuery;
  /** the run's Environment (time of day + weather set by the session) */
  env: Environment;
  /** the rider's loadout (dresses the rig the intro builds when none is passed) */
  loadout: Loadout;
  /** where the run starts; default query.data.spawn */
  spawn?: CityData['spawn'];
  /** the session's scene (city + Environment attached there); default: a new scene with both attached */
  scene?: Scene;
  /** the session's RiderRig, posed at the stand (default: the intro builds and owns one) */
  rig?: RiderRig;
  /** the session's ride camera: the swoop lands exactly on its framing (default: the intro makes one — `cameraRig`) */
  cameraRig?: CameraRig;
  /** the session's traffic, kept alive (stepped + drawn) while the phone is up */
  traffic?: StreetLifeParts;
  reducedMotion?: boolean;
}

/**
 * The intro backdrop: the rider idling on the bike at the home win stand in the run's own city, Aunt Lek chopping
 * chicken at her khao man gai cart, traffic passing — framed in the space left of the gram phone. `swoopToRide()`
 * cranes up to an establishing shot and swoops down onto the diorama chase framing (Lek waves, the rider beeps).
 * While it runs, `update` also advances the Environment, the city view and the optional traffic. Once the swoop
 * resolves, PLAY takes over: keep driving the same CameraRig (`cameraRig`), stop updating the intro and dispose it.
 */
export class IntroScene implements BackdropScene {
  readonly scene: Scene;
  readonly site: StandSite;
  /** the ride camera the swoop lands on (the session's, or the intro's own for the session to adopt) */
  readonly cameraRig: CameraRig;
  private readonly city: CityView;
  private readonly env: Environment;
  private readonly ownsScene: boolean;
  private readonly rider: IdleRider;
  private readonly addedRig: boolean;
  private readonly lek: AuntLek | null;
  private readonly life: StreetLife | null;
  private readonly cam: IntroCamera;
  private readonly parallax = new PointerParallax();
  private readonly post = new BackdropPost();
  private readonly focus = new Vector3();
  private readonly cityFrame: CityFrame;
  private engine: Engine | null = null;
  private offQuality: (() => void) | null = null;
  private reduced = false;

  /** models the intro instances itself (rider rig, Lek); the city's are the session's business */
  static assetNames(): string[] {
    return riderRigAssetNames();
  }

  /** needs `IntroScene.assetNames()` preloaded */
  constructor(engine: Engine, assets: Assets, opts: IntroSceneOptions) {
    this.city = opts.city;
    this.env = opts.env;
    this.ownsScene = !opts.scene;
    this.scene = opts.scene ?? new Scene();
    if (this.ownsScene) {
      this.scene.name = 'intro_backdrop';
      opts.env.attach(this.scene);
    }
    if (!opts.city.root.parent) this.scene.add(opts.city.root);
    this.site = findStandSite(opts.query, opts.spawn);
    const sp = this.site.spawn;
    const ground = opts.city.groundHeight(sp.pos.x, sp.pos.z);
    this.rider = new IdleRider(assets, opts.loadout, engine.quality, opts.rig);
    this.rider.place(sp.pos, sp.heading, opts.query.surfaceAt(sp.pos.x, sp.pos.z), ground);
    this.addedRig = !this.rider.root.parent;
    if (this.addedRig) this.scene.add(this.rider.root);
    const lek = this.site.lek;
    this.lek = lek ? new AuntLek(assets, lek, opts.city.groundHeight(lek.pos.x, lek.pos.z)) : null;
    if (this.lek) this.scene.add(this.lek.root);
    this.life = opts.traffic ? StreetLife.wrap(opts.traffic) : null;
    if (this.life && !this.life.view.root.parent) this.scene.add(this.life.view.root);
    this.cameraRig = opts.cameraRig ?? new CameraRig(engine.camera);
    if (!opts.cameraRig) this.cameraRig.setWorld(opts.query);
    this.cam = new IntroCamera(this.site, this.cameraRig, ground, new Sightlines(opts.query, opts.query.data));
    this.focus.set(sp.pos.x, ground, sp.pos.z);
    this.reducedMotion = opts.reducedMotion ?? false;
    this.cityFrame = {
      night: 0, lamps: 0, wet: 0, camPos: engine.camera.position, focus: sp.pos, signal: this.life?.signal ?? (() => null),
    };
  }

  set reducedMotion(on: boolean) {
    this.reduced = on;
    this.parallax.enabled = !on;
    this.cameraRig.reducedMotion = on;
  }

  /** job accepted: crane up, swoop down onto the ride framing; resolves on landing (cuts with reduced motion) */
  swoopToRide(seconds = 3.4): Promise<void> {
    if (this.cam.swooping) return Promise.resolve();
    this.rider.lookAround = false;
    this.rider.rig.horn();
    this.lek?.wave();
    return this.cam.swoop(seconds, this.reduced);
  }

  /** straight to the ride framing (debug skip / restarts) */
  skipToRide(): Promise<void> {
    return this.cam.swoop(0, true);
  }

  enter(engine: Engine): void {
    this.engine = engine;
    engine.setScene(this.scene);
    this.offQuality?.();
    this.offQuality = engine.onQualityChange((q) => this.rider.rig.setQuality(q));
    this.parallax.attach();
    this.post.snap();
  }

  update(dt: number): void {
    const e = this.engine;
    if (!e) return;
    this.parallax.update(dt);
    const cam = this.cam.update(dt, e.camera, this.rider.state, this.parallax.value);
    const env = this.env;
    env.update(dt, this.focus);
    this.rider.update(dt, env.lampsOn, env.night);
    if (this.lek && this.site.lek) {
      const l = this.site.lek;
      const sp = this.site.spawn.pos;
      this.lek.update(dt, wrapAngle(headingOf({ x: sp.x - l.pos.x, z: sp.z - l.pos.z }) - l.heading));
    }
    this.life?.update(this.rider.state, {
      camera: e.camera, dt, night: env.night, lamps: env.lampsOn, rain: env.weather.rain,
      groundHeight: this.city.groundHeight, drawDistance: e.quality.drawDistance,
    });
    const f = this.cityFrame;
    f.night = env.night;
    f.lamps = env.lampsOn;
    f.wet = Math.min(1, env.weather.rain * 1.3);
    this.city.update(dt, f);
    this.post.apply(e, env.grade(), cam);
  }

  exit(): void {
    this.offQuality?.();
    this.offQuality = null;
    this.parallax.detach();
    this.engine = null;
  }

  /** frees what the intro made; the city, Environment, traffic and any borrowed rig stay with the session */
  dispose(): void {
    this.exit();
    this.lek?.dispose();
    this.life?.dispose();
    if (this.addedRig) this.rider.root.removeFromParent();
    this.rider.dispose();
    if (this.ownsScene) this.scene.remove(this.city.root, this.env.root);
  }
}
