import { type Camera, Group, Vector3 } from 'three';
import { PALETTE } from '../../core/config/palette';
import { clamp } from '../../core/math2d';
import type { CityQuery, MissionPhase, PassengerProfile, PlayerState, POI, ScreenPoint } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import { type CurbSpot, curbSpot } from './curb-spot';
import { DestFlag } from './dest-flag';
import { createGroundRing, tickRing } from './ground-ring';
import type { GroundFn } from './route-ribbon';
import { TargetPin } from './target-pin';
import { WaitingPassenger } from './waiting-passenger';

/** what the markers read from the mission (MissionController satisfies it) */
export interface MarkerSource {
  readonly phase: MissionPhase;
  readonly pickup: POI;
  readonly drop: POI;
  readonly passenger: PassengerProfile;
  /** boarding / drop-off moment playing */
  readonly holdBike: boolean;
}

/** cyan rider ring (mockup 03) radius / line half width (m) */
const RIDER_RING_R = 1.08;

/**
 * Everything the mission draws in the world besides the route: the coral target pin + stop zone, the cyan ring under
 * the rider, the customer waiting (and waving) at the pickup, the checkered flag at the destination. Also projects the
 * pin for the HUD (`targetScreen`).
 */
export class MissionMarkers {
  readonly root = new Group();
  readonly pin = new TargetPin();
  readonly flag = new DestFlag();
  readonly waiting: WaitingPassenger;
  private readonly riderRing = createGroundRing({ color: PALETTE.gramCyan, radius: RIDER_RING_R, width: 0.04, fill: 0.025, glow: 0.3 });
  private readonly pickupSpot: CurbSpot;
  private readonly dropSpot: CurbSpot;
  private readonly v = new Vector3();
  private time = 0;
  private ringShow = 0;

  constructor(assets: Assets, city: CityQuery, private readonly ground: GroundFn, source: MarkerSource) {
    this.root.name = 'mission_markers';
    this.waiting = new WaitingPassenger(assets, ground);
    this.pickupSpot = curbSpot(city, source.pickup);
    // the flag stands a few steps up the kerb so the passenger gets off beside it, not into it
    const kerb = curbSpot(city, source.drop, 0.45);
    const ahead = 3.2;
    this.dropSpot = {
      pos: { x: kerb.pos.x + Math.sin(source.drop.heading) * ahead, z: kerb.pos.z + Math.cos(source.drop.heading) * ahead },
      face: kerb.face,
    };
    this.root.add(this.pin.root, this.flag.root, this.waiting.root, this.riderRing);
  }

  /**
   * Per render frame. `camera` scales the pin for distance; `pov` hides the rider ring (first-person view).
   */
  update(dt: number, m: MarkerSource, player: PlayerState, camera: Camera | null, pov = false): void {
    this.time += dt;
    const ph = m.phase;
    const toPickup = ph === 'intro' || ph === 'toPickup';
    const toDrop = (ph === 'toDropoff' || ph === 'arriving') && !m.holdBike;
    const target = toPickup ? m.pickup : toDrop ? m.drop : null;
    this.pin.setTarget(target ? target.pos : null, target ? this.ground(target.pos.x, target.pos.z) : 0);
    this.pin.update(dt, camera ? camera.position : null);

    if (toPickup && !this.waiting.root.visible) this.waiting.place(m.passenger, this.pickupSpot.pos, this.pickupSpot.face);
    else if (!toPickup && this.waiting.root.visible) this.waiting.hide();
    this.waiting.update(dt, player);

    const flagOn = ph === 'toDropoff' || ph === 'arriving';
    const fp = this.dropSpot.pos;
    this.flag.place(flagOn ? fp : null, this.ground(fp.x, fp.z), this.dropSpot.face + Math.PI / 2);
    this.flag.update(dt);

    const live = ph !== 'complete' && ph !== 'failed';
    const want = live && !pov && !player.fallen ? 1 : 0;
    this.ringShow = clamp(this.ringShow + (want - this.ringShow) * Math.min(1, dt * 6), 0, 1);
    this.riderRing.position.set(player.pos.x, this.ground(player.pos.x, player.pos.z), player.pos.z);
    tickRing(this.riderRing, this.time, this.ringShow);
  }

  /** the pin head in CSS pixels, or null when hidden / behind the camera / off screen */
  targetScreen(camera: Camera, width: number, height: number): ScreenPoint | null {
    if (!this.pin.visible) return null;
    const v = this.pin.anchor(this.v).project(camera);
    if (v.z > 1 || v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1) return null;
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  }

  dispose(): void {
    this.pin.dispose();
    this.flag.dispose();
    this.waiting.dispose();
    this.riderRing.geometry.dispose();
    this.riderRing.material.dispose();
    this.root.removeFromParent();
  }
}
