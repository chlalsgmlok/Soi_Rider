import type { Object3D } from 'three';
import { findNode } from '../../engine/assets/material-tools';
import type { PlayerState } from '../../core/types';

/** visible bar travel per unit of steering input on top of the (small, at speed) physical steer angle */
const BAR_INPUT = 0.07;
/** suspension travel limits (m): extension below rest / compression above */
const EXTEND = 0.06;
const COMPRESS = 0.075;

/**
 * Bike-level procedural animation on the GLB node contract (blender/assets/bikes/README.md):
 * steering about the raked `steer` axis, wheel spin, fork + shock travel from pitch and bounce.
 */
export class BikeAnimator {
  readonly steer: Object3D | null;
  readonly wheelF: Object3D | null;
  readonly wheelR: Object3D | null;
  private readonly rake: number;
  private readonly restF: number;
  private readonly restR: number;
  private readonly spinRestF: number;
  private readonly radius: number;
  readonly wheelbase: number;
  private spin = 0;
  private bars = 0;

  constructor(bike: Object3D) {
    this.steer = findNode(bike, 'steer');
    this.wheelF = findNode(bike, 'wheel_F');
    this.wheelR = findNode(bike, 'wheel_R');
    this.rake = this.steer?.rotation.x ?? 0;
    this.restF = this.wheelF?.position.y ?? 0;
    this.restR = this.wheelR?.position.y ?? 0;
    this.spinRestF = this.wheelF?.rotation.x ?? 0;
    let extras: Record<string, unknown> = {};
    bike.traverse((o) => {
      if (typeof o.userData.wheel_radius === 'number') extras = o.userData;
    });
    this.radius = typeof extras.wheel_radius === 'number' ? extras.wheel_radius : 0.28;
    this.wheelbase = typeof extras.wheelbase === 'number' ? extras.wheelbase : 1.26;
  }

  /** current visual bar angle (rad, + = left like Object3D.rotation.y) */
  get barAngle(): number {
    return this.bars;
  }

  update(dt: number, s: PlayerState, steerInput: number): void {
    const speedK = Math.min(1, Math.abs(s.speed) / 6);
    const target = s.fallen ? this.bars * 0.98 : -(s.steer + steerInput * BAR_INPUT * speedK);
    this.bars += (target - this.bars) * Math.min(1, dt * 18);
    if (this.steer) this.steer.rotation.set(this.rake, this.bars, 0);

    this.spin = (this.spin + (s.speed / this.radius) * dt) % (Math.PI * 2);
    const half = this.wheelbase / 2;
    // body dips (bounce < 0) → wheels compress up; body pops up → wheels hang (then the bike hops)
    const travel = (v: number): number => Math.min(COMPRESS, Math.max(-EXTEND, v));
    if (this.wheelF) {
      this.wheelF.rotation.x = this.spinRestF + this.spin;
      this.wheelF.position.y = this.restF + travel(-s.bounce + s.pitch * half);
    }
    if (this.wheelR) {
      this.wheelR.rotation.x = this.spin;
      this.wheelR.position.y = this.restR + travel(-s.bounce - s.pitch * half);
    }
  }
}
