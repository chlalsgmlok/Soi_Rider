import { Color, Euler, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import type { VehicleKind } from '../../core/types';
import { lookUnit } from '../peds/ped-looks';
import type { Vehicle } from '../sim/vehicle';
import type { AgentFxTable } from './agent-fx';
import { colorOf, createLook, driverLook, pillionLook, riderLook } from './char-looks';
import { createPose } from './character-rig';
import { clearPose, driverPose, pillionPose, riderPose } from './character-pose';
import { ANIM_DIST, type DrawFrame, DRIVER_DIST } from './draw-frame';
import type { RigSet } from './rig-set';
import type { MotoPose } from './moto-rig';
import type { VehiclePose } from './vehicle-rig';
import { carLights, motoLights } from './vehicle-lights';

/** driver hip point per model (model space: +X = model left, so right-hand drive sits at −X) */
const DRIVER_SEAT: Partial<Record<VehicleKind, readonly [number, number, number]>> = {
  taxi: [-0.37, 0.6, 0.05], sedan: [-0.37, 0.58, 0.05], van: [-0.45, 0.92, 1.3], pickup: [-0.4, 0.82, 0.55],
  songthaew: [-0.4, 0.82, 1.45], bus: [-0.8, 1.5, 4.5], tuktuk: [0, 0.82, 0.62],
};
/** hip height of char_body standing (hips rest translation) */
const HIP = 0.92;
const PILLION_SHARE = 0.14;

const m = new Matrix4();
const root = new Matrix4();
const off = new Matrix4();
const q = new Quaternion();
const e = new Euler(0, 0, 0, 'YXZ');
const pos = new Vector3();
const one = new Vector3(1, 1, 1);
const sphere = new Sphere();
const pose = createPose();
const look = createLook();
const carPose: VehiclePose = {
  matrix: m, paint: new Color(), paint2: new Color(), brake: 0, left: 0, right: 0, night: 0, spin: 0, steer: 0, foldL: 0, foldR: 0,
};
const motoPose: MotoPose = { matrix: m, paint: new Color(), paint2: new Color(), brake: 0, night: 0, spin: 0, steer: 0 };

/**
 * Draws every NPC vehicle into the instanced rigs: body pose, wheel roll / steer, brake lamps, blinking indicators,
 * folding mirrors, drivers behind the glass, motorbike riders (and the odd pillion) leaning into turns, and the
 * night lamp flares / headlight fans. Off-screen vehicles still advance their animation state but draw nothing.
 */
export class VehicleDrawer {
  constructor(private readonly rigs: RigSet, private readonly fx: AgentFxTable) {}

  draw(vehicles: readonly Vehicle[], f: DrawFrame): number {
    let drawn = 0;
    for (const v of vehicles) {
      const fx = this.fx.get(v.id);
      const moto = v.isMoto ? this.rigs.motos[v.look % this.rigs.motos.length] : null;
      const car = moto ? null : this.rigs.cars.get(v.kind);
      fx.update(v, f.dt, moto ? moto.wheelRadius : (car?.wheelRadius ?? 0.33), v.spec.length * (moto ? 0.66 : 0.58));
      const d = Math.hypot(v.pos.x - f.camX, v.pos.z - f.camZ);
      sphere.center.set(v.pos.x, 1, v.pos.z);
      sphere.radius = v.halfLen + 1.5;
      if (!f.frustum.intersectsSphere(sphere)) continue;
      const animate = d < ANIM_DIST;
      const y = f.ground(v.pos.x, v.pos.z);
      e.set(0, v.heading, moto ? fx.lean : 0);
      m.compose(pos.set(v.pos.x, y, v.pos.z), q.setFromEuler(e), one);
      const blink = (f.time * 1.6 + (v.id % 7) * 0.13) % 1 < 0.5;
      if (moto) {
        motoPose.paint.copy(colorOf(v.paint));
        motoPose.paint2.copy(colorOf(v.paint2));
        motoPose.brake = v.braking ? 1 : 0;
        motoPose.night = f.lamps;
        motoPose.spin = fx.spin;
        motoPose.steer = Math.max(-0.5, Math.min(0.5, fx.steer * 1.3));
        if (moto.write(motoPose, animate) < 0) continue;
        this.rider(moto.seat.x, moto.seat.y, moto.seat.z, v, fx.lean, f, false);
        if (lookUnit(v.look, 30) < PILLION_SHARE) this.rider(moto.pillion.x, moto.pillion.y, moto.pillion.z, v, fx.lean, f, true);
        motoLights(this.rigs.glow, m, moto.headLamp, moto.tailLamp, v, f.lamps, f.night);
      } else if (car) {
        carPose.paint.copy(colorOf(v.paint));
        carPose.paint2.copy(colorOf(v.paint2));
        carPose.brake = v.braking ? 1 : 0;
        carPose.left = v.indicator < 0 && blink ? 1 : 0;
        carPose.right = v.indicator > 0 && blink ? 1 : 0;
        carPose.night = f.lamps;
        carPose.spin = fx.spin;
        carPose.steer = fx.steer;
        carPose.foldL = fx.foldL;
        carPose.foldR = fx.foldR;
        if (!car.write(carPose, animate)) continue;
        const seat = DRIVER_SEAT[v.kind];
        if (seat && d < DRIVER_DIST) {
          root.multiplyMatrices(m, off.makeTranslation(seat[0], seat[1] - HIP, seat[2]));
          clearPose(pose);
          driverPose(pose, f.time, v.look);
          this.rigs.people.write(root, v.heading, pose, driverLook(v.look, look));
        }
        carLights(this.rigs.glow, m, car.lamps, v, f.lamps, f.night, blink);
      }
      drawn++;
    }
    return drawn;
  }

  private rider(x: number, y: number, z: number, v: Vehicle, lean: number, f: DrawFrame, pillion: boolean): void {
    root.multiplyMatrices(m, off.makeTranslation(x, y - HIP, z));
    clearPose(pose);
    if (pillion) {
      pillionPose(pose);
      this.rigs.people.write(root, v.heading, pose, pillionLook(v.look, look));
    } else {
      riderPose(pose, lean, v.look);
      this.rigs.people.write(root, v.heading, pose, riderLook(v.look, f.rain, look));
    }
  }
}
