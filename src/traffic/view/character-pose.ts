import { J, JOINTS, type PoseBuffer } from './character-rig';

/**
 * Procedural poses for the segmented NPC rig, as joint Euler angles in the model frame (+X = model left, +Z
 * forward): limbs swing FORWARD with negative X rotation, the torso / head lean forward with positive X, a left
 * arm lifts sideways with positive Z (right arm negative).
 */
const set = (p: PoseBuffer, j: number, x: number, y: number, z: number): void => {
  p[j * 3] = x;
  p[j * 3 + 1] = y;
  p[j * 3 + 2] = z;
};

export function clearPose(p: PoseBuffer): void {
  p.fill(0, 0, JOINTS.length * 3);
}

/**
 * Walk cycle: legs swing opposite, knees fold on the back swing, arms counter-swing, a little torso twist and head
 * counter-turn. `phase` in radians (2π per stride), `amount` 0 (standing) … 1 (full stride).
 */
export function walkPose(p: PoseBuffer, phase: number, amount: number): void {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const a = 0.48 * amount;
  set(p, J.thigh_L, -a * s, 0, 0.02);
  set(p, J.thigh_R, a * s, 0, -0.02);
  set(p, J.shin_L, amount * (0.18 + 0.42 * Math.max(0, c)), 0, 0);
  set(p, J.shin_R, amount * (0.18 + 0.42 * Math.max(0, -c)), 0, 0);
  set(p, J.foot_L, amount * 0.25 * s, 0, 0);
  set(p, J.foot_R, -amount * 0.25 * s, 0, 0);
  set(p, J.arm_L, a * 0.75 * s, 0, 0.06);
  set(p, J.arm_R, -a * 0.75 * s, 0, -0.06);
  set(p, J.forearm_L, -0.25 - 0.2 * amount * Math.max(0, s), 0, 0);
  set(p, J.forearm_R, -0.25 - 0.2 * amount * Math.max(0, -s), 0, 0);
  set(p, J.torso, 0.04 * amount, 0.08 * amount * s, 0);
  set(p, J.head, -0.02, -0.06 * amount * s, 0);
  set(p, J.hips, 0, -0.06 * amount * s, 0);
}

/** standing still: weight shift and breathing, arms relaxed */
export function idlePose(p: PoseBuffer, t: number, seed: number): void {
  const w = Math.sin(t * 0.7 + seed);
  set(p, J.hips, 0, 0.05 * w, 0.02 * w);
  set(p, J.torso, 0.02 + 0.01 * Math.sin(t * 1.9 + seed), -0.04 * w, -0.02 * w);
  set(p, J.head, 0.04 * Math.sin(t * 0.5 + seed * 2), 0.25 * Math.sin(t * 0.23 + seed), 0);
  set(p, J.arm_L, 0.02, 0, 0.05);
  set(p, J.arm_R, 0.02, 0, -0.05);
  set(p, J.forearm_L, -0.2, 0, 0);
  set(p, J.forearm_R, -0.2, 0, 0);
}

/** seated: thighs forward, shins down to the pegs / pedals */
function seated(p: PoseBuffer, spread: number): void {
  set(p, J.thigh_L, -1.42, 0, spread);
  set(p, J.thigh_R, -1.42, 0, -spread);
  set(p, J.shin_L, 1.3, 0, -spread * 0.6);
  set(p, J.shin_R, 1.3, 0, spread * 0.6);
  set(p, J.foot_L, 0.1, 0, 0);
  set(p, J.foot_R, 0.1, 0, 0);
}

/** motorbike rider: leaning into the bars, hands on the grips, head up; `lean` adds body English into turns */
export function riderPose(p: PoseBuffer, lean: number, look: number): void {
  seated(p, 0.2);
  set(p, J.torso, 0.22, 0, -lean * 0.25);
  set(p, J.head, -0.2, 0.15 * Math.sin(look), lean * 0.2);
  set(p, J.arm_L, -1.0, 0, -0.12);
  set(p, J.arm_R, -1.0, 0, 0.12);
  set(p, J.forearm_L, -0.45, 0, 0);
  set(p, J.forearm_R, -0.45, 0, 0);
}

/** pillion passenger: upright, hands on the thighs */
export function pillionPose(p: PoseBuffer): void {
  seated(p, 0.26);
  set(p, J.torso, 0.05, 0, 0);
  set(p, J.arm_L, -0.35, 0, 0.1);
  set(p, J.arm_R, -0.35, 0, -0.1);
  set(p, J.forearm_L, -0.9, 0, 0);
  set(p, J.forearm_R, -0.9, 0, 0);
}

/** car / tuk-tuk driver: seated upright, both hands on the wheel */
export function driverPose(p: PoseBuffer, t: number, look: number): void {
  seated(p, 0.12);
  set(p, J.torso, 0.06, 0, 0);
  set(p, J.head, 0, 0.3 * Math.sin(t * 0.3 + look) * Math.sin(t * 0.11 + look * 3), 0);
  set(p, J.arm_L, -0.95, 0, -0.08);
  set(p, J.arm_R, -0.95, 0, 0.08);
  set(p, J.forearm_L, -0.75, 0, 0);
  set(p, J.forearm_R, -0.75, 0, 0);
}

/** right hand up holding an umbrella shaft in front of the shoulder */
export function umbrellaArm(p: PoseBuffer): void {
  set(p, J.arm_R, -0.55, 0, 0.12);
  set(p, J.forearm_R, -1.45, 0, 0);
  set(p, J.hand_R, 0.3, 0, 0);
}

/** monk: both hands in front holding the alms bowl */
export function monkArms(p: PoseBuffer): void {
  set(p, J.arm_L, -0.45, 0, -0.1);
  set(p, J.arm_R, -0.45, 0, 0.1);
  set(p, J.forearm_L, -1.25, 0, -0.25);
  set(p, J.forearm_R, -1.25, 0, 0.25);
}

/** street vendor working at the cart: arms forward, small chopping / ladling motion */
export function vendorPose(p: PoseBuffer, t: number, seed: number): void {
  idlePose(p, t, seed);
  const k = Math.sin(t * 4.2 + seed) * 0.5 + 0.5;
  set(p, J.torso, 0.12, 0.1 * Math.sin(t * 0.6 + seed), 0);
  set(p, J.arm_L, -0.7, 0, -0.1);
  set(p, J.arm_R, -0.75 - 0.25 * k, 0, 0.1);
  set(p, J.forearm_L, -0.85, 0, 0);
  set(p, J.forearm_R, -0.7 - 0.35 * k, 0, 0);
}

/** scared jump-back: arms flung up, torso leaning away; blended by k (0..1) */
export function startlePose(p: PoseBuffer, k: number): void {
  const b = (j: number, x: number, z: number): void => {
    p[j * 3] += (x - p[j * 3]) * k;
    p[j * 3 + 2] += (z - p[j * 3 + 2]) * k;
  };
  b(J.arm_L, -2.3, 0.5);
  b(J.arm_R, -2.3, -0.5);
  b(J.forearm_L, -0.6, 0);
  b(J.forearm_R, -0.6, 0);
  b(J.torso, -0.22, 0);
  b(J.head, -0.15, 0);
}
