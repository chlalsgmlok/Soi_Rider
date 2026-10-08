import type { Scene } from 'three';
import { BIKES } from '../../core/config/bikes';
import { TRAITS } from '../../core/config/scoring';
import type { EventBus } from '../../core/events';
import { KMH } from '../../core/math2d';
import type { CityQuery, Loadout, PassengerProfile, TrafficQuery, Vec2 } from '../../core/types';
import { CameraRig } from '../../camera/camera-rig';
import type { CameraPost } from '../../camera/camera-pose';
import type { Assets } from '../../engine/assets/assets';
import type { Engine } from '../../engine/engine';
import { ClearanceSensor } from '../../physics/clearance-sensor';
import { CollisionSystem } from '../../physics/collision-system';
import type { ContactReport } from '../../physics/collision-types';
import type { StyleEvent } from '../../physics/style-events';
import { StyleSensor } from '../../physics/style-sensor';
import { BikePhysics, type RideInput } from '../../player/bike-physics';
import { PovCockpit } from '../../player/cockpit/pov-cockpit';
import { gripFor, type RideEnv } from '../../player/ride-env';
import { RiderRig } from '../../player/rig/rider-rig';

export interface RideLook {
  night: number;
  lamps: number;
  wet: number;
  groundY: number;
}

/**
 * The rideable bike of the mission sandbox — the real player stack wired the way docs/ARCHITECTURE.md's PLAY frame
 * order describes: BikePhysics → CollisionSystem → ClearanceSensor + StyleSensor (step), RiderRig + PovCockpit +
 * CameraRig (render). Contacts go out as 'collision' bus events (the app does the same).
 */
export class MissionRide {
  readonly bike: BikePhysics;
  readonly rig: RiderRig;
  readonly cockpit: PovCockpit;
  readonly cam: CameraRig;
  readonly clearance = new ClearanceSensor();
  contacts: ContactReport[] = [];
  style: StyleEvent[] = [];
  private readonly collisions = new CollisionSystem();
  private readonly styleSensor = new StyleSensor();
  private readonly env: RideEnv;
  private input: RideInput = { throttle: 0, brake: 0, steer: 0, tuck: false };

  constructor(private readonly engine: Engine, scene: Scene, assets: Assets, private readonly city: CityQuery,
    loadout: Loadout, private readonly bus: EventBus) {
    this.bike = new BikePhysics(BIKES[loadout.bike], bus);
    this.rig = new RiderRig(assets, loadout, engine.quality);
    scene.add(this.rig.root);
    this.cockpit = new PovCockpit(this.rig, engine.quality);
    this.cockpit.attach(engine.camera);
    this.cam = new CameraRig(engine.camera);
    this.cam.setWorld(city);
    this.env = { grip: gripFor(0), surfaceAt: (x, z) => city.surfaceAt(x, z), extraWidth: 0, nearestLane: (p, d) => city.nearestLane(p, d) };
    bus.on('player:fall', () => {
      this.cam.eventShot('fall', null, 2.3);
      this.cam.shake(0.8, 0.6);
    });
  }

  place(pos: Vec2, heading: number): void {
    this.bike.teleport({ x: pos.x, z: pos.z }, heading);
    this.collisions.reset();
    this.styleSensor.reset();
    this.cam.snap();
  }

  /** pillion on / off (shopper bags widen the bike, a passenger softens acceleration) */
  carry(p: PassengerProfile | null): void {
    this.env.extraWidth = p ? TRAITS[p.trait].extraWidth : 0;
    this.env.load = p ? 0.6 : 0;
  }

  setWetness(wet: number): void {
    this.env.grip = gripFor(wet);
  }

  step(dt: number, input: RideInput, traffic: TrafficQuery | null): void {
    this.input = input;
    this.bike.step(dt, input, this.env);
    this.contacts = this.collisions.resolve(this.bike, this.city, traffic, dt);
    this.clearance.sense(this.bike, this.city, traffic);
    this.style = this.styleSensor.step(dt, this.bike, this.clearance, this.contacts, traffic);
    for (const c of this.contacts) {
      this.bus.emit('collision', { kind: c.kind, heavy: c.heavy, speedKmh: c.speedKmh, point: c.point, other: c.other });
      if (!c.heavy) this.cam.shake(c.kind === 'curb' ? 0.25 : 0.4, 0.3);
    }
  }

  /** visuals + camera for one rendered frame; returns the camera's tilt-shift post */
  render(dt: number, look: RideLook, scene: Scene): CameraPost {
    const s = this.bike.state;
    this.rig.update(dt, s, { steer: this.input.steer, brake: this.input.brake, lamps: look.lamps, night: look.night, groundY: look.groundY });
    const post = this.cam.update(dt, s, this.clearance.info);
    this.cockpit.setActive(this.cam.povActive);
    this.cockpit.update(s, Math.abs(s.speed) * KMH, look.night);
    this.cockpit.renderMirrors(this.engine.renderer, scene);
    return post;
  }
}
