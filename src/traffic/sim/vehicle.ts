import { VEHICLES } from '../../core/config/traffic';
import type { OBB, TrafficAgentView, VehicleKind, VehicleSpec, Vec2 } from '../../core/types';
import { clamp } from '../../core/math2d';
import { bodyPose } from './body-pose';
import type { IdmParams } from './idm';
import { setObb } from './obb-depth';
import type { Pose, Tracks } from './tracks';

/** what the vehicle is currently braking for (debug overlays, honk rules) */
export type LeaderKind = 'none' | 'vehicle' | 'pedestrian' | 'player' | 'stop';

const MIRROR_HL = 0.09;
const pose: Pose = { x: 0, z: 0, h: 0 };

/** body yaw from sideways motion: none when (almost) standing — a bike walked sideways does not rotate */
export function yawFor(latVel: number, speed: number): number {
  const moving = clamp((Math.abs(speed) - 0.3) / 1.7, 0, 1);
  return clamp(Math.atan2(latVel, Math.max(3, Math.abs(speed))), -0.25, 0.25) * moving;
}

/**
 * One NPC vehicle (car or motorbike). Public readonly-view fields satisfy `TrafficAgentView`; the rest is
 * simulation state owned by the drivers in this folder. Objects are pooled — `reset` re-initialises everything.
 */
export class Vehicle implements TrafficAgentView {
  id = -1;
  kind: VehicleKind = 'sedan';
  spec: VehicleSpec = VEHICLES.sedan;
  readonly pos: Vec2 = { x: 0, z: 0 };
  heading = 0;
  speed = 0;
  readonly obb: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };
  readonly mirrors: OBB[] = [];
  braking = false;
  indicator: -1 | 0 | 1 = 0;
  honking = false;
  paint = '#ffffff';
  paint2 = '#ffffff';
  look = 0;
  laneId = -1;
  queued = false;

  alive = false;
  isMoto = false;
  /** current track + arc length of the body centre along it, and the track it came from (-1 none) */
  track = 0;
  prevTrack = -1;
  s = 0;
  /** lateral offset from the track centreline (+ = left of travel) and its target / rate */
  lat = 0;
  latTarget = 0;
  latVel = 0;
  /** personal lateral habit inside a lane (cars) */
  jitter = 0;
  /** upcoming tracks (connector, lane, connector …) */
  readonly route: number[] = [];
  accel = 0;
  v0 = 10;
  idm: IdmParams = { a: 2, b: 3, T: 1.4, s0: 2 };
  /** connector track this vehicle is cleared to enter (-1 none) */
  grant = -1;
  /** seconds spent waiting for a junction gate */
  wait = 0;
  /** seconds at (almost) standstill without a red light ahead */
  stuck = 0;
  /** seconds stopped behind the player / a pedestrian / a non-moving vehicle on green */
  blocked = 0;
  honkLeft = 0;
  honkCooldown = 0;
  startDelay = 0;
  wasStopped = false;
  leader: LeaderKind = 'none';
  /** remaining seconds of the current lane change, its direction and cooldown */
  laneChange = 0;
  lcDir: -1 | 0 | 1 = 0;
  lcCooldown = 0;
  /** motorbike: next slot re-evaluation, nudge wobble */
  slotTimer = 0;
  nudgeVel = 0;
  exhaustCooldown = 0;
  /** seconds since spawn */
  age = 0;
  /** idle-step bookkeeping (see idle.ts) and what the last full plan saw */
  idleSkip = 0;
  wantGo = false;
  heldByLight = false;
  atGate = false;
  /** id of the body the motion guard stopped this vehicle against last step (-1 none, -2 rider) */
  wedgedOn = -1;
  wedgeTime = 0;
  halfLen = 1;
  halfW = 0.5;

  reset(id: number, spec: VehicleSpec, isMoto: boolean): void {
    this.id = id;
    this.kind = spec.kind;
    this.spec = spec;
    this.isMoto = isMoto;
    this.alive = true;
    this.halfLen = spec.length / 2;
    this.halfW = spec.width / 2;
    this.speed = 0;
    this.accel = 0;
    this.lat = this.latTarget = this.latVel = this.jitter = 0;
    this.route.length = 0;
    this.prevTrack = -1;
    this.grant = -1;
    this.wait = this.stuck = this.blocked = this.honkLeft = this.honkCooldown = this.startDelay = 0;
    this.laneChange = this.lcCooldown = this.slotTimer = this.nudgeVel = this.exhaustCooldown = this.age = 0;
    this.idleSkip = 0;
    this.wantGo = this.heldByLight = this.atGate = false;
    this.wedgedOn = -1;
    this.wedgeTime = 0;
    this.lcDir = 0;
    this.indicator = 0;
    this.braking = this.honking = this.queued = this.wasStopped = false;
    this.leader = 'none';
    this.mirrors.length = 0;
    if (spec.mirrorSpan > spec.width) {
      this.mirrors.push({ cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 }, { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 });
    }
  }

  /** recompute world pose, hull and mirror boxes from track / s / lat */
  place(tracks: Tracks): void {
    bodyPose(tracks, this.track, this.s, this.lat, this.halfLen, pose, this.prevTrack, this.route[0] ?? -1);
    this.laneId = tracks.isLane(this.track) ? this.track : -1;
    this.setPose(pose.x, pose.z, pose.h, pose.h + yawFor(this.latVel, this.speed));
  }

  /**
   * Put the body at a world pose and refresh hull + mirror boxes. The hull follows the path heading; `heading`
   * (what views draw) adds the small yaw of sideways motion — a cosmetic that must never rotate the hull into a
   * neighbour.
   */
  setPose(x: number, z: number, hullAngle: number, heading: number): void {
    this.pos.x = x;
    this.pos.z = z;
    this.heading = heading;
    setObb(this.obb, x, z, this.halfW, this.halfLen, hullAngle);
    if (this.mirrors.length === 2) {
      const span = this.spec.mirrorSpan / 2;
      const hw = (span - this.halfW) / 2 + 0.03;
      const off = (span + this.halfW) / 2;
      const f = this.spec.mirrorZ;
      const fx = Math.sin(hullAngle);
      const fz = Math.cos(hullAngle);
      // left(θ) = (cos θ, −sin θ) = (fz, −fx)
      setObb(this.mirrors[0], x + fz * off + fx * f, z - fx * off + fz * f, hw, MIRROR_HL, hullAngle);
      setObb(this.mirrors[1], x - fz * off + fx * f, z + fx * off + fz * f, hw, MIRROR_HL, hullAngle);
    }
  }

}
