import type { Camera } from 'three';
import type { EventBus } from '../../core/events';
import type { JobOffer, PlayerState, RunConfig, Vec2 } from '../../core/types';
import type { Assets } from '../../engine';
import { MissionController, type MissionHooks, MissionMarkers, RouteLine } from '../../mission';
import type { WeatherSystem } from '../../weather';
import type { RideStack } from './ride-stack';
import type { SessionWorld } from './session-world';

export interface RunStart {
  pos: Vec2;
  heading: number;
}

export interface RunWiring {
  world: SessionWorld;
  ride: RideStack;
  weather: WeatherSystem;
  assets: Assets;
  bus: EventBus;
  /** key-cap label of the interact control in the prompts (E / A / 탭) */
  interactKey: string;
  ended(phase: 'complete' | 'failed'): void;
}

/**
 * One attempt at the accepted gram job: the MissionController with its scripted moments (boarding, drop-off, raincoat
 * / mask) played on the rider rig and camera, the cyan route ribbon and the pickup / drop markers. A restart throws
 * it away and builds a fresh one.
 */
export class SessionRun {
  readonly mission: MissionController;
  readonly routeLine: RouteLine;
  readonly markers: MissionMarkers;

  constructor(w: RunWiring, config: RunConfig, job: JobOffer, readonly start: RunStart) {
    const { ride, weather } = w;
    const hooks: MissionHooks = {
      board(p, sec) {
        ride.rig.setPassenger(p);
        ride.carry(p);
        weather.gloss.add(ride.rig.root);
        ride.cam.eventShot('boarding', null, sec + 0.3);
        return ride.rig.board(sec);
      },
      dismount(_p, sec) {
        ride.cam.eventShot('dropoff', null, sec + 0.4);
        ride.carry(null);
        return ride.rig.dismount(sec);
      },
      care(poncho, mask) {
        ride.rig.setCare(poncho, mask);
        weather.gloss.add(ride.rig.root);
      },
      ended: (phase) => w.ended(phase),
    };
    const city = w.world.city;
    this.mission = new MissionController({ city: w.world.query, config, job, bus: w.bus, hooks, start, interactKey: w.interactKey });
    this.routeLine = new RouteLine(city.groundHeight);
    w.world.scene.add(this.routeLine.mesh);
    this.markers = new MissionMarkers(w.assets, w.world.query, city.groundHeight, this.mission);
    w.world.scene.add(this.markers.root);
  }

  /** per rendered frame: the ribbon follows the route, the pin / passenger / flag animate */
  frame(dt: number, camera: Camera, night: number, player: PlayerState, pov: boolean): void {
    const m = this.mission;
    this.routeLine.setPath(m.nav.path);
    this.routeLine.update(dt, m.nav.s, night);
    this.markers.update(dt, m, player, camera, pov);
  }

  dispose(): void {
    this.routeLine.mesh.removeFromParent();
    this.routeLine.dispose();
    this.markers.root.removeFromParent();
    this.markers.dispose();
  }
}
