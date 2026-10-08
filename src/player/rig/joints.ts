import type { Object3D, Vector3 } from 'three';
import { findNode } from '../../engine/assets/material-tools';

/** [left, right] */
export type Pair = [Object3D, Object3D];

/** The 15-node segmented body of char_body (docs/ASSET_SPEC.md › Characters), rest pose = identity rotations. */
export interface BodyJoints {
  /** the instance root (moved to seat the hips) */
  root: Object3D;
  hips: Object3D;
  torso: Object3D;
  head: Object3D;
  arm: Pair;
  forearm: Pair;
  hand: Pair;
  thigh: Pair;
  shin: Pair;
  foot: Pair;
  /** rest local position of the hips (y ≈ 0.92) */
  hipsRest: Vector3;
}

function need(root: Object3D, name: string): Object3D {
  const n = findNode(root, name);
  if (!n) throw new Error(`[rider-rig] char_body is missing node "${name}"`);
  return n;
}

export function bodyJoints(root: Object3D): BodyJoints {
  const pair = (base: string): Pair => [need(root, `${base}_L`), need(root, `${base}_R`)];
  const hips = need(root, 'hips');
  return {
    root, hips, torso: need(root, 'torso'), head: need(root, 'head'),
    arm: pair('arm'), forearm: pair('forearm'), hand: pair('hand'),
    thigh: pair('thigh'), shin: pair('shin'), foot: pair('foot'),
    hipsRest: hips.position.clone(),
  };
}

/** zero every joint rotation (rest A-pose) */
export function resetPose(j: BodyJoints): void {
  for (const o of [j.hips, j.torso, j.head, ...j.arm, ...j.forearm, ...j.hand, ...j.thigh, ...j.shin, ...j.foot]) {
    o.rotation.set(0, 0, 0);
  }
  j.hips.position.copy(j.hipsRest);
}

/** joint rotations keyed by node base name; `_L` values mirror to `_R` with y/z negated */
export interface PoseDef {
  torso: [number, number, number];
  head: [number, number, number];
  arm: [number, number, number];
  forearm: [number, number, number];
  thigh: [number, number, number];
  shin: [number, number, number];
  foot: [number, number, number];
}

/** reference poses from blender/lib/characters_pose.py (see blender/assets/characters/README.md) */
export const POSES: Readonly<Record<'ride' | 'pillion' | 'stand' | 'sprawl', PoseDef>> = {
  ride: { torso: [0.22, 0, 0], head: [-0.12, 0, 0], arm: [-1.0, 0, -0.12], forearm: [-0.45, 0, 0], thigh: [-1.25, 0, 0.12], shin: [1.15, 0, 0], foot: [0.1, 0, 0] },
  pillion: { torso: [0.12, 0, 0], head: [-0.05, 0, 0], arm: [-0.5, 0, -0.3], forearm: [-0.9, 0, 0], thigh: [-1.3, 0, 0.22], shin: [1.25, 0, 0], foot: [0.05, 0, 0] },
  stand: { torso: [0.02, 0, 0], head: [0, 0, 0], arm: [0.05, 0, 0.02], forearm: [-0.12, 0, 0], thigh: [0, 0, 0.02], shin: [0, 0, 0], foot: [0, 0, 0] },
  sprawl: { torso: [-0.15, 0, 0.1], head: [-0.3, 0.4, 0], arm: [-0.4, 0, 1.25], forearm: [-0.5, 0, 0], thigh: [-0.3, 0, 0.35], shin: [0.5, 0, 0], foot: [0.3, 0, 0] },
};

/** set every joint rotation from a pose (left values as given, right side mirrored) */
export function applyPose(j: BodyJoints, p: PoseDef): void {
  j.torso.rotation.set(...p.torso);
  j.head.rotation.set(...p.head);
  for (let s = 0; s < 2; s++) {
    const m = s === 0 ? 1 : -1;
    j.arm[s].rotation.set(p.arm[0], p.arm[1] * m, p.arm[2] * m);
    j.forearm[s].rotation.set(p.forearm[0], p.forearm[1] * m, p.forearm[2] * m);
    j.thigh[s].rotation.set(p.thigh[0], p.thigh[1] * m, p.thigh[2] * m);
    j.shin[s].rotation.set(p.shin[0], p.shin[1] * m, p.shin[2] * m);
    j.foot[s].rotation.set(p.foot[0], p.foot[1] * m, p.foot[2] * m);
  }
}

/** lerp two poses into `out` */
export function mixPose(a: PoseDef, b: PoseDef, t: number, out: PoseDef): PoseDef {
  for (const k of Object.keys(out) as Array<keyof PoseDef>) {
    for (let i = 0; i < 3; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
  }
  return out;
}

export const blankPose = (): PoseDef => ({
  torso: [0, 0, 0], head: [0, 0, 0], arm: [0, 0, 0], forearm: [0, 0, 0], thigh: [0, 0, 0], shin: [0, 0, 0], foot: [0, 0, 0],
});
