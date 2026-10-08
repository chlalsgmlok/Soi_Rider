import { Group } from 'three';
import { angleDiff, damp, headingOf } from '../../core/math2d';
import type { PassengerProfile, PlayerState, Vec2 } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import { applyPose, POSES } from '../../player/rig/joints';
import { PassengerRig } from '../../player/rig/passenger';
import type { GroundFn } from './route-ribbon';

/** the rider is "arriving" within this distance (m): the passenger walks up to where boarding starts … */
const MEET = 12;
/** … and waves from this far (m) */
const WAVE_FROM = 45;
const WALK_SPEED = 1.35;
/** where RiderRig's boarding timeline starts, in the bike frame (left = +x, behind = −z) — src/player/rig/boarding.ts */
const BOARD_X = 1.75;
const BOARD_Z = -0.95;

/**
 * The customer waiting at the curb (char_body dressed from the PassengerLook, no helmet yet): idles, turns to the
 * approaching rider and waves, then walks up to the bike's curb side so RiderRig.board() continues seamlessly.
 */
export class WaitingPassenger {
  readonly root = new Group();
  private rig: PassengerRig | null = null;
  private readonly home: Vec2 = { x: 0, z: 0 };
  private readonly at: Vec2 = { x: 0, z: 0 };
  private readonly meet: Vec2 = { x: 0, z: 0 };
  private roadYaw = 0;
  private yaw = 0;
  private y = 0;
  private wave = 0;
  private walk = 0;
  private phase = 0;
  private t = 0;

  constructor(private readonly assets: Assets, private readonly ground: GroundFn) {
    this.root.name = 'waiting_passenger';
    this.root.visible = false;
  }

  /** stand at `spot` on the sidewalk facing the road (`faceYaw`); rebuilds the body for a new profile */
  place(profile: PassengerProfile, spot: Vec2, faceYaw: number): void {
    if (this.rig?.profile !== profile) {
      this.rig?.dispose();
      this.rig = new PassengerRig(this.assets, profile);
      this.rig.helmet.visible = false;
      this.rig.setSeated(0);
      this.root.add(this.rig.body);
    }
    Object.assign(this.home, spot);
    Object.assign(this.at, spot);
    this.roadYaw = this.yaw = faceYaw;
    this.y = this.ground(spot.x, spot.z);
    this.root.visible = true;
  }

  hide(): void {
    this.root.visible = false;
  }

  update(dt: number, rider: PlayerState | null): void {
    const r = this.rig;
    if (!r || !this.root.visible) return;
    this.t += dt;
    const d = rider ? Math.hypot(rider.pos.x - this.at.x, rider.pos.z - this.at.z) : Infinity;
    const meeting = rider !== null && d < MEET && Math.abs(rider.speed) < 3;
    const goal = meeting && rider ? meetPoint(rider, this.meet) : this.home;
    const gx = goal.x - this.at.x;
    const gz = goal.z - this.at.z;
    const gap = Math.hypot(gx, gz);
    const moving = gap > 0.08;
    if (moving) {
      const step = Math.min(gap, WALK_SPEED * dt);
      this.at.x += (gx / gap) * step;
      this.at.z += (gz / gap) * step;
    }
    this.walk += ((moving ? 1 : 0) - this.walk) * damp(8, dt);
    this.phase += this.walk * dt * 7.5;
    const look = moving ? headingOf({ x: gx, z: gz }) : rider && d < WAVE_FROM ? headingOf({ x: rider.pos.x - this.at.x, z: rider.pos.z - this.at.z }) : this.roadYaw;
    this.yaw += angleDiff(this.yaw, look) * damp(5, dt);
    this.wave += ((rider && d < WAVE_FROM && !moving ? 1 : 0) - this.wave) * damp(4, dt);
    this.y += (this.ground(this.at.x, this.at.z) - this.y) * damp(12, dt);
    this.pose(r);
  }

  dispose(): void {
    this.rig?.dispose();
    this.rig = null;
    this.root.removeFromParent();
  }

  private pose(r: PassengerRig): void {
    const j = r.j;
    applyPose(j, POSES.stand);
    const sw = Math.sin(this.phase) * 0.5 * this.walk;
    j.thigh[0].rotation.x += sw;
    j.thigh[1].rotation.x -= sw;
    j.shin[0].rotation.x += Math.max(0, -Math.sin(this.phase)) * 0.6 * this.walk;
    j.shin[1].rotation.x += Math.max(0, Math.sin(this.phase)) * 0.6 * this.walk;
    j.arm[0].rotation.x -= sw * 0.7;
    j.arm[1].rotation.x += sw * 0.7;
    // a friendly wave with the right hand
    const w = this.wave;
    j.arm[1].rotation.x += -2.7 * w;
    j.arm[1].rotation.z += -0.3 * w;
    j.forearm[1].rotation.x += -0.5 * w;
    j.forearm[1].rotation.z += Math.sin(this.t * 9) * 0.45 * w;
    j.hips.position.copy(j.hipsRest);
    j.hips.position.y += Math.abs(Math.sin(this.phase)) * 0.025 * this.walk;
    j.hips.rotation.set(0, 0, Math.sin(this.t * 1.1) * 0.035 * (1 - this.walk));
    j.head.rotation.y = Math.sin(this.t * 0.45) * 0.3 * (1 - w) * (1 - this.walk);
    r.body.position.set(this.at.x, this.y, this.at.z);
    r.body.rotation.set(0, this.yaw, 0);
  }
}

/** where boarding begins beside a stopped bike (curb side, a step behind the rider) */
function meetPoint(s: PlayerState, out: Vec2): Vec2 {
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  // left(θ) = (cos θ, −sin θ) = (fz, −fx)
  out.x = s.pos.x + fz * BOARD_X + fx * BOARD_Z;
  out.z = s.pos.z - fx * BOARD_X + fz * BOARD_Z;
  return out;
}
