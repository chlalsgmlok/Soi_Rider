import type { Object3D, Vector3 } from 'three';
import { applyPose, type BodyJoints, blankPose, mixPose, POSES } from './joints';
import { bump, span, track } from './keyframes';

export type BoardingKind = 'board' | 'dismount';

/** Where the passenger is in a boarding / dismount moment (bike frame; the curb is on the LEFT = +X). */
export interface BoardingFrame {
  x: number;
  z: number;
  /** extra hip lift while swinging a leg over the seat */
  lift: number;
  yaw: number;
  walk: number;
  phase: number;
  armsUp: number;
  legOver: number;
  /** 0 standing placement … 1 seated on the pillion */
  seated: number;
  wave: number;
  helmetOnPassenger: boolean;
  /** 0..1 the rider's left arm holds the spare helmet out to the passenger */
  riderReach: number;
}

const H = Math.PI / 2;

/**
 * Scripted boarding (walk up from the curb, take the helmet from the rider, put it on, swing the right leg over,
 * sit and hold on) and dismount (swing off, hand the helmet back, walk to the curb, turn and wave).
 */
export class BoardingTimeline {
  readonly frame: BoardingFrame = {
    x: 0, z: 0, lift: 0, yaw: 0, walk: 0, phase: 0, armsUp: 0, legOver: 0, seated: 0, wave: 0, helmetOnPassenger: false,
    riderReach: 0,
  };
  private t = 0;
  private readonly mixed = blankPose();

  constructor(readonly kind: BoardingKind, readonly seconds: number, private readonly seatZ: number) {}

  get done(): boolean {
    return this.t >= this.seconds;
  }

  get progress(): number {
    return Math.min(1, this.t / this.seconds);
  }

  advance(dt: number): BoardingFrame {
    this.t = Math.min(this.seconds, this.t + dt);
    const u = this.progress;
    const f = this.frame;
    const z = this.seatZ;
    if (this.kind === 'board') {
      f.x = track([[0, 1.75], [0.42, 0.62], [0.6, 0.58], [0.75, 0.3], [0.86, 0]], u);
      f.z = track([[0, -0.95], [0.42, z - 0.05], [1, z]], u);
      f.yaw = track([[0, -H], [0.42, -H], [0.56, 0]], u);
      f.walk = track([[0, 1], [0.36, 1], [0.44, 0]], u);
      f.armsUp = bump(u, 0.43, 0.6);
      f.legOver = bump(u, 0.58, 0.92);
      f.lift = track([[0.56, 0], [0.74, 0.22], [0.86, 0.14], [1, 0]], u);
      f.seated = span(u, 0.8, 1);
      f.wave = 0;
      f.helmetOnPassenger = u >= 0.42;
      f.riderReach = track([[0.08, 0], [0.28, 1], [0.42, 1], [0.52, 0]], u);
    } else {
      f.seated = 1 - span(u, 0, 0.24);
      f.legOver = bump(u, 0.03, 0.34);
      f.lift = track([[0, 0], [0.12, 0.2], [0.3, 0]], u);
      f.x = track([[0.08, 0], [0.26, 0.6], [0.5, 0.62], [0.84, 1.9]], u);
      f.z = track([[0, z], [0.26, z - 0.1], [0.84, -0.25]], u);
      f.yaw = track([[0, 0], [0.45, 0], [0.55, H], [0.84, H], [0.95, -H]], u);
      f.walk = track([[0.5, 0], [0.56, 1], [0.82, 1], [0.88, 0]], u);
      f.armsUp = bump(u, 0.27, 0.46);
      f.wave = span(u, 0.88, 0.96);
      f.helmetOnPassenger = u < 0.4;
      f.riderReach = track([[0.3, 0], [0.4, 1], [0.5, 1], [0.6, 0]], u);
    }
    f.phase += f.walk * dt * 7.5;
    return f;
  }

  /** pose the passenger body for the current frame (bike frame placement; `seat` = pillion hip point) */
  pose(j: BodyJoints, body: Object3D, seat: Vector3): void {
    const f = this.frame;
    const sit = f.seated;
    applyPose(j, mixPose(POSES.stand, POSES.pillion, sit, this.mixed));
    const sw = Math.sin(f.phase) * 0.5 * f.walk;
    j.thigh[0].rotation.x += sw;
    j.thigh[1].rotation.x -= sw;
    j.shin[0].rotation.x += Math.max(0, -Math.sin(f.phase)) * 0.6 * f.walk;
    j.shin[1].rotation.x += Math.max(0, Math.sin(f.phase)) * 0.6 * f.walk;
    j.arm[0].rotation.x -= sw * 0.7;
    j.arm[1].rotation.x += sw * 0.7;
    // both hands up to the helmet
    for (let i = 0; i < 2; i++) {
      j.arm[i].rotation.x += -2.5 * f.armsUp;
      j.arm[i].rotation.z += (i === 0 ? 0.35 : -0.35) * f.armsUp;
      j.forearm[i].rotation.x += -1.3 * f.armsUp;
    }
    // right leg up and over the seat, the standing knee bends
    j.thigh[1].rotation.x += -1.45 * f.legOver;
    j.thigh[1].rotation.z += -0.85 * f.legOver;
    j.shin[1].rotation.x += 1.2 * f.legOver;
    j.shin[0].rotation.x += 0.25 * f.legOver;
    // a cheerful wave goodbye
    j.arm[1].rotation.x += -2.7 * f.wave;
    j.arm[1].rotation.z += -0.3 * f.wave;
    j.forearm[1].rotation.z += Math.sin(this.t * 14) * 0.45 * f.wave;
    j.forearm[1].rotation.x += -0.5 * f.wave;

    const standY = f.lift;
    const seatY = seat.y + 0.05 - j.hipsRest.y;
    body.position.set(f.x + (seat.x - f.x) * sit, standY + (seatY - standY) * sit, f.z + (seat.z - f.z) * sit);
    body.rotation.set(0, f.yaw * (1 - sit), 0);
    j.hips.position.copy(j.hipsRest);
    j.hips.position.y += Math.abs(Math.sin(f.phase)) * 0.025 * f.walk;
    j.hips.rotation.set(0, 0, 0);
  }
}
