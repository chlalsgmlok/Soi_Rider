import { Group, type Object3D } from 'three';
import { type BodyJoints, bodyJoints } from '../joints';

/** hips rest height of char_body (docs/ASSET_SPEC.md › Characters) */
const HIPS_Y = 0.92;

function joint(name: string, parent: Object3D, x = 0, y = 0, z = 0): Group {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** The 15 named joints of char_body as empty groups, for animator tests that run without the GLB. */
export function fakeBodyJoints(): BodyJoints {
  const root = new Group();
  root.name = 'char_body';
  const hips = joint('hips', root, 0, HIPS_Y, 0);
  const torso = joint('torso', hips, 0, 0.1, 0);
  joint('head', torso, 0, 0.55, 0);
  for (const [side, x] of [['L', 1], ['R', -1]] as const) {
    const arm = joint(`arm_${side}`, torso, x * 0.2, 0.45, 0);
    const forearm = joint(`forearm_${side}`, arm, 0, -0.28, 0);
    joint(`hand_${side}`, forearm, 0, -0.26, 0);
    const thigh = joint(`thigh_${side}`, hips, x * 0.1, -0.05, 0);
    const shin = joint(`shin_${side}`, thigh, 0, -0.42, 0);
    joint(`foot_${side}`, shin, 0, -0.42, 0);
  }
  return bodyJoints(root);
}
