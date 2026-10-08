import { type Object3D, Quaternion, Vector3 } from 'three';
import { RIDE } from '../../core/config/bikes';
import { clamp, damp } from '../../core/math2d';
import type { PlayerState } from '../../core/types';
import { findNode } from '../../engine/assets/material-tools';
import { applyPose, type BodyJoints, POSES } from './joints';
import { bump } from './keyframes';
import { headLook } from './head-look';
import { alignWorld, solveTwoBone } from './limb-ik';

const tv = new Vector3();
const tw = new Vector3();
const fk = new Vector3();
const pole = new Vector3();
const q = new Quaternion();
const q2 = new Quaternion();
const qFoot = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.12);

/** ankle above the peg / ground point (bike frame offsets, m) */
const ANKLE_ON_PEG = new Vector3(0, 0.075, -0.04);
const ANKLE_UP = 0.085;
const HORN_TIME = 0.4;
/** where the left hand holds the spare helmet out to a passenger at the curb (bike frame) */
const HAND_OUT = new Vector3(0.6, 1.14, -0.12);

/** The bike's attach points for the rider, read once per bike. */
export interface SeatPoints {
  grips: [Object3D, Object3D];
  pegs: [Vector3, Vector3];
  seat: Vector3;
}

export function seatPoints(bike: Object3D, seatNode: string): SeatPoints {
  const pos = (n: string, fallback: Vector3): Vector3 => findNode(bike, n)?.position.clone() ?? fallback;
  const gl = findNode(bike, 'grip_L') ?? bike;
  const gr = findNode(bike, 'grip_R') ?? bike;
  return {
    grips: [gl, gr],
    pegs: [pos('foot_L', new Vector3(0.2, 0.3, 0)), pos('foot_R', new Vector3(-0.2, 0.3, 0))],
    seat: pos(seatNode, new Vector3(0, 0.86, -0.14)),
  };
}

/**
 * Seated rider: ride pose + 15 % extra lean with a hip shift into the turn, head looking through the corner and
 * counter-rolled, hands IK'd onto the (steering) grips, feet on the pegs or — below 2 m/s — the inside foot (both
 * at a stop) reaching for the ground, tuck crouch, braking brace and a horn-thumb gesture.
 */
export class RiderAnimator {
  /** roll the bike leans toward a planted foot (rad, + = right) */
  standLean = 0;
  /** 0..1 the left hand leaves the grip to hold the spare helmet out (boarding) */
  reach = 0;
  private tuck = 0;
  private feet: [number, number] = [0, 0];
  private look = 0;
  private hornT = 0;
  private idle = 0;

  constructor(private readonly j: BodyJoints, private readonly frame: Object3D, private readonly ground: Object3D) {}

  horn(): void {
    this.hornT = HORN_TIME;
  }

  /** phase 1 (before the world-matrix update): joint rotations + hips placement */
  pose(dt: number, s: PlayerState, steerInput: number, seat: Vector3): void {
    const j = this.j;
    this.tuck += ((s.tuck ? 1 : 0) - this.tuck) * damp(9, dt);
    this.hornT = Math.max(0, this.hornT - dt);
    const slow = s.feetDown && !s.fallen;
    const stopped = Math.abs(s.speed) < 0.6;
    const inside = steerInput > 0.15 ? 1 : 0; // 0 = left foot (default), 1 = right
    for (let i = 0; i < 2; i++) {
      const want = slow && (stopped || i === inside) ? 1 : 0;
      this.feet[i] += (want - this.feet[i]) * damp(want ? 9 : 6, dt);
    }
    this.standLean = (this.feet[1] - this.feet[0]) * 0.065 + (this.feet[0] > 0.5 && this.feet[1] > 0.5 ? -0.025 : 0);
    this.idle = stopped ? this.idle + dt : 0;
    const glance = this.idle > 2.5 ? Math.sin((this.idle - 2.5) * 0.6) * 0.45 : 0;
    const lookTarget = headLook(s.yawRate, steerInput) + glance;
    this.look += (lookTarget - this.look) * damp(5, dt);

    applyPose(j, POSES.ride);
    const brace = clamp(-s.accel * 0.012, 0, 0.09);
    j.hips.position.set(
      j.hipsRest.x - Math.sign(s.lean) * Math.min(0.07, Math.abs(s.lean) * 0.09),
      j.hipsRest.y,
      j.hipsRest.z - 0.05 * this.tuck,
    );
    j.root.position.set(seat.x, seat.y + 0.04 - j.hipsRest.y, seat.z);
    j.hips.rotation.set(0, 0, s.lean * RIDE.riderLeanExtra);
    j.torso.rotation.set(0.22 + 0.42 * this.tuck + brace, -steerInput * 0.06, 0);
    j.head.rotation.set(-0.12 - 0.38 * this.tuck - brace, this.look, -s.lean * 0.55);
  }

  /**
   * phase 2 (world matrices current): limbs onto grips / pegs / ground. `arms` / `legs` 0..1 blend from the
   * current (posed) hand/foot positions to the holds — the get-up after a fall eases the rider back onto the bike.
   */
  solve(sp: SeatPoints, arms = 1, legs = 1): void {
    const j = this.j;
    this.frame.getWorldQuaternion(q);
    const horn = bump(1 - this.hornT / HORN_TIME, 0, 1);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      if (arms > 0.001) {
        sp.grips[i].getWorldPosition(tv);
        if (i === 0 && horn > 0) tv.add(tw.set(-0.03 * horn, 0.04 * horn, 0).applyQuaternion(q));
        if (i === 0 && this.reach > 0) tv.lerp(this.frame.localToWorld(tw.copy(HAND_OUT)), this.reach);
        if (arms < 1) tv.lerpVectors(j.hand[i].getWorldPosition(fk), tv, arms);
        pole.set(side * (0.55 - 0.3 * this.tuck), -0.7 - 0.2 * this.tuck, -0.45 + 0.25 * this.tuck).applyQuaternion(q);
        solveTwoBone(j.arm[i], j.forearm[i], j.hand[i], tv, pole);
      }
      if (legs <= 0.001) continue;

      const peg = tw.copy(sp.pegs[i]).add(ANKLE_ON_PEG);
      this.frame.localToWorld(peg);
      const w = this.feet[i];
      if (w > 0.001) {
        tv.set(side * 0.42, ANKLE_UP, sp.seat.z + 0.12);
        this.ground.localToWorld(tv);
        peg.lerp(tv, w);
      }
      if (legs < 1) peg.lerpVectors(j.foot[i].getWorldPosition(fk), peg, legs);
      pole.set(side * (0.22 - 0.15 * this.tuck), 0.15, 1).applyQuaternion(q);
      solveTwoBone(j.thigh[i], j.shin[i], j.foot[i], peg, pole);
      alignWorld(j.foot[i], q2.copy(q).multiply(qFoot));
    }
  }
}
