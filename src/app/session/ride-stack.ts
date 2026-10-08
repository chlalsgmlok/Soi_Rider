import type { Scene, Vector3 } from 'three';
import { type CameraPost, CameraRig, type OrbitOptions } from '../../camera';
import { BIKES } from '../../core/config/bikes';
import { TRAITS } from '../../core/config/scoring';
import type { EventBus } from '../../core/events';
import { KMH } from '../../core/math2d';
import type { CameraMode, CityQuery, Loadout, PassengerProfile, TrafficQuery, Vec2 } from '../../core/types';
import type { Assets, Engine, QualitySettings } from '../../engine';
import { ClearanceSensor, CollisionSystem, type ContactReport, type StyleEvent, StyleSensor } from '../../physics';
import { BikePhysics, gripFor, PovCockpit, type RideEnv, type RideInput, RiderRig, type RigFrame } from '../../player';

export interface RideLook {
  night: number;
  lamps: number;
  groundY: number;
}

/**
 * The player's ride, wired in the PLAY frame order (docs/ARCHITECTURE.md): BikePhysics → CollisionSystem →
 * ClearanceSensor + StyleSensor each fixed step (contacts go out as 'collision' bus events), RiderRig + CameraRig +
 * PovCockpit each rendered frame. Built from the sandbox assembly (src/mission/dev/mission-ride.ts).
 */
export class RideStack {
  readonly bike: BikePhysics;
  readonly rig: RiderRig;
  readonly cockpit: PovCockpit;
  readonly cam: CameraRig;
  readonly clearance = new ClearanceSensor();
  /** contacts that started this step / raw style detections this step (MissionFrame) */
  contacts: ContactReport[] = [];
  style: StyleEvent[] = [];
  /** the ride input applied this step (bars, brake light, engine sound) */
  readonly input: RideInput = { throttle: 0, brake: 0, steer: 0, tuck: false };
  private readonly collisions = new CollisionSystem();
  private readonly styleSensor = new StyleSensor();
  private readonly env: RideEnv;
  private readonly rigFrame: RigFrame = { steer: 0, brake: 0, lamps: 0, night: 0, groundY: 0 };

  constructor(private readonly engine: Engine, scene: Scene, assets: Assets, city: CityQuery, loadout: Loadout,
    private readonly bus: EventBus, opts: { mode: CameraMode; reducedMotion: boolean }) {
    this.bike = new BikePhysics(BIKES[loadout.bike], bus);
    this.rig = new RiderRig(assets, loadout, engine.quality);
    scene.add(this.rig.root);
    this.cockpit = new PovCockpit(this.rig, engine.quality);
    this.cockpit.attach(engine.camera);
    this.cam = new CameraRig(engine.camera, { reducedMotion: opts.reducedMotion });
    this.cam.setWorld(city);
    this.cam.setMode(opts.mode);
    this.env = {
      grip: gripFor(0), surfaceAt: (x, z) => city.surfaceAt(x, z), extraWidth: 0, nearestLane: (p, d) => city.nearestLane(p, d),
    };
    bus.on('player:fall', () => {
      this.cam.eventShot('fall', null, 2.3);
      this.cam.shake(0.8, 0.6);
    }, this);
  }

  /** park the bike (start, restart, fall recovery): physics, sensors and the camera start fresh */
  place(pos: Vec2, heading: number): void {
    this.bike.teleport({ x: pos.x, z: pos.z }, heading);
    this.collisions.reset();
    this.styleSensor.reset();
    this.cam.snap();
  }

  /** pillion on / off: a shopper's bags widen the bike, a passenger softens acceleration and braking */
  carry(p: PassengerProfile | null): void {
    this.env.extraWidth = p ? TRAITS[p.trait].extraWidth : 0;
    this.env.load = p ? 0.6 : 0;
  }

  /** road wetness (WeatherSystem.wetness) → tyre grip */
  setWet(wetness: number): void {
    this.env.grip = gripFor(wetness);
  }

  step(dt: number, input: RideInput, traffic: TrafficQuery | null, city: CityQuery): void {
    Object.assign(this.input, input);
    this.bike.step(dt, input, this.env);
    this.contacts = this.collisions.resolve(this.bike, city, traffic, dt);
    this.clearance.sense(this.bike, city, traffic);
    this.style = this.styleSensor.step(dt, this.bike, this.clearance, this.contacts, traffic);
    for (const c of this.contacts) {
      this.bus.emit('collision', { kind: c.kind, heavy: c.heavy, speedKmh: c.speedKmh, point: c.point, other: c.other });
      if (!c.heavy) this.cam.shake(c.kind === 'curb' ? 0.25 : 0.4, 0.3);
    }
  }

  /** riding frame: rig, chase / POV camera, cockpit; returns the camera's tilt-shift post */
  render(dt: number, look: RideLook, scene: Scene): CameraPost {
    const s = this.bike.state;
    this.animate(dt, look);
    const post = this.cam.update(dt, s, this.clearance.info);
    this.cockpit.setActive(this.cam.povActive);
    this.cockpit.update(s, Math.abs(s.speed) * KMH, look.night);
    this.cockpit.renderMirrors(this.engine.renderer, scene);
    return post;
  }

  /** results backdrop: the rig keeps animating while the camera slowly orbits it */
  orbit(dt: number, look: RideLook, target: Vector3, t: number, opts: OrbitOptions): CameraPost {
    this.animate(dt, look);
    this.cockpit.setActive(false);
    return this.cam.orbit(target, t, opts);
  }

  /** C / Y / camera button: AUTO → diorama → POV, announced on the bus (HUD chip, click sound) */
  cycleCamera(): CameraMode {
    const mode = this.cam.cycleMode();
    this.bus.emit('camera:mode', { mode });
    return mode;
  }

  setCameraMode(mode: CameraMode): void {
    if (this.cam.mode === mode) return;
    this.cam.setMode(mode);
    this.bus.emit('camera:mode', { mode });
  }

  horn(): void {
    this.rig.horn();
    const p = this.bike.state.pos;
    this.bus.emit('horn', { by: 'player', pos: { x: p.x, z: p.z } });
  }

  setQuality(q: QualitySettings): void {
    this.rig.setQuality(q);
    this.cockpit.setQuality(q);
  }

  dispose(): void {
    this.bus.offAllOwnedBy(this);
    this.cockpit.dispose();
    this.rig.root.removeFromParent();
    this.rig.dispose();
  }

  private animate(dt: number, look: RideLook): void {
    const f = this.rigFrame;
    f.steer = this.input.steer;
    f.brake = this.input.brake;
    f.lamps = look.lamps;
    f.night = look.night;
    f.groundY = look.groundY;
    this.rig.update(dt, this.bike.state, f);
  }
}
