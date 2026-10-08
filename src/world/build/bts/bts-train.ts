import { type BufferGeometry, InstancedMesh, type Material, Matrix4 } from 'three';
import { poseMatrix } from '../templates/placement-matrix';
import { type BtsLine, RAIL_Y, trackPoint } from './bts-line';

const CARS = 4;
const CAR_PITCH = 22.6;
const CRUISE = 16;
const ACCEL = 1.1;
const DWELL = 7;
/** a train every HEADWAY seconds, alternating direction */
export const HEADWAY = 40;
const FIRST = 2;
/** the first train of a run enters this far before the station, so the line is alive from the start */
const FIRST_LEAD = 170;
const MAX_TRAINS = 3;
const RUN_OFF = 120;

interface Train {
  sign: 1 | -1;
  s: number;
  v: number;
  dwell: number;
  served: boolean;
}

const m = new Matrix4();

/**
 * Four-car BTS trains gliding along the viaduct every ~40 s, alternating direction, braking into the station, dwelling
 * and pulling out. One InstancedMesh of the baked bts_train (uber material: head / tail lights glow at night).
 */
export class BtsTrains {
  readonly mesh: InstancedMesh;
  private readonly trains: Train[] = [];
  private clock = HEADWAY - FIRST;
  private nextSign: 1 | -1 = 1;
  private first = true;

  constructor(private readonly line: BtsLine, geometry: BufferGeometry, material: Material) {
    this.mesh = new InstancedMesh(geometry, material, CARS * MAX_TRAINS);
    this.mesh.name = 'bts_trains';
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  get active(): number {
    return this.trains.length;
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.clock >= HEADWAY && this.trains.length < MAX_TRAINS) {
      this.clock = 0;
      const sign = this.nextSign;
      this.nextSign = sign > 0 ? -1 : 1;
      const mid = this.line.station ?? (this.line.s0 + this.line.s1) / 2;
      const s = this.first ? mid - sign * FIRST_LEAD : sign > 0 ? this.line.s0 - RUN_OFF : this.line.s1 + RUN_OFF;
      this.first = false;
      this.trains.push({ sign, s, v: CRUISE, dwell: 0, served: this.line.station === null });
    }
    for (const t of this.trains) this.advance(t, dt);
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const t = this.trains[i];
      if ((t.sign > 0 && t.s > this.line.s1 + RUN_OFF) || (t.sign < 0 && t.s < this.line.s0 - RUN_OFF)) this.trains.splice(i, 1);
    }
    this.layout();
  }

  private advance(t: Train, dt: number): void {
    if (t.dwell > 0) {
      t.dwell -= dt;
      if (t.dwell <= 0) t.served = true;
      return;
    }
    const st = this.line.station;
    if (!t.served && st !== null) {
      const ahead = (st - t.s) * t.sign;
      const brake = (t.v * t.v) / (2 * ACCEL);
      if (ahead <= 0.4) {
        t.s = st;
        t.v = 0;
        t.dwell = DWELL;
        return;
      }
      t.v = ahead <= brake + 0.5 ? Math.max(0.8, t.v - ACCEL * dt) : Math.min(CRUISE, t.v + ACCEL * dt);
    } else {
      t.v = Math.min(CRUISE, t.v + ACCEL * dt);
    }
    t.s += t.sign * t.v * dt;
  }

  private layout(): void {
    let k = 0;
    const heading = (sign: number): number => this.line.heading + (sign > 0 ? 0 : Math.PI);
    for (const t of this.trains) {
      for (let c = 0; c < CARS; c++) {
        const s = t.s + t.sign * (c - (CARS - 1) / 2) * CAR_PITCH;
        const p = trackPoint(this.line, s, t.sign);
        this.mesh.setMatrixAt(k++, poseMatrix(p.x, RAIL_Y, p.z, heading(t.sign), 1, m));
      }
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (k > 0) this.mesh.computeBoundingSphere();
  }

  dispose(): void {
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}
