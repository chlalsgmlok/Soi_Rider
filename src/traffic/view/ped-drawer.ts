import { Euler, Matrix4, Quaternion, Sphere, Vector3 } from 'three';
import type { Pedestrian } from '../peds/pedestrian';
import { createLook, pedLook } from './char-looks';
import { createPose } from './character-rig';
import { clearPose, idlePose, monkArms, startlePose, umbrellaArm, vendorPose, walkPose } from './character-pose';
import { ANIM_DIST, type DrawFrame, PEOPLE_DIST } from './draw-frame';
import type { RigSet } from './rig-set';

/** metres walked per full stride cycle */
const STRIDE = 1.4;

const root = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const p3 = new Vector3();
const one = new Vector3(1, 1, 1);
const sphere = new Sphere();
const pose = createPose();
const look = createLook();

/**
 * Draws pedestrians into the character rig: walk cycle from the distance walked (with a little bounce), idle
 * stance while waiting at the kerb, vendors working at their carts, monks with their alms bowls, umbrellas in the
 * rain and the arms-up jump when the rider startles them. Far away people freeze in a neutral pose.
 */
export class PedDrawer {
  constructor(private readonly rigs: RigSet) {}

  draw(peds: readonly Pedestrian[], f: DrawFrame): number {
    let drawn = 0;
    for (const p of peds) {
      const d = Math.hypot(p.pos.x - f.camX, p.pos.z - f.camZ);
      if (d > PEOPLE_DIST) continue;
      sphere.center.set(p.pos.x, 0.9, p.pos.z);
      sphere.radius = 1.2;
      if (!f.frustum.intersectsSphere(sphere)) continue;
      const phase = (p.gait / STRIDE) * Math.PI * 2;
      const walking = p.mode === 'walk' || p.mode === 'path';
      const amount = walking ? Math.min(1, p.speed / 1.25) : 0;
      clearPose(pose);
      if (d < ANIM_DIST) {
        const seed = (p.id % 97) * 0.37;
        if (p.role === 'vendor') vendorPose(pose, f.time, seed);
        else if (amount > 0.05) walkPose(pose, phase, amount);
        else idlePose(pose, f.time, seed);
        if (p.role === 'monk') monkArms(pose);
        if (p.umbrella) umbrellaArm(pose);
        if (p.startled > 0) startlePose(pose, Math.min(1, p.startled * 1.5));
      }
      const bob = amount * 0.025 * (1 - Math.cos(phase * 2)) * 0.5;
      e.set(0, p.heading, 0);
      root.compose(p3.set(p.pos.x, f.ground(p.pos.x, p.pos.z) + bob, p.pos.z), q.setFromEuler(e), one);
      this.rigs.people.write(root, p.heading, pose, pedLook(p, look));
      drawn++;
    }
    return drawn;
  }
}
