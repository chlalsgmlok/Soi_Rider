import type { Object3D } from 'three';
import { findNode } from './material-tools';

/**
 * Outfit sleeve node → the char_body joint it follows (blender/assets/characters/README.md › Attachments). The
 * hoodie and track jacket ship their sleeves as children of the outfit root, authored at the rest A-pose shoulder /
 * elbow with the joint pivot as origin, so on the joint they need a zero local transform.
 */
export const SLEEVE_JOINTS = [
  ['sleeve_upper_L', 'arm_L'], ['sleeve_lower_L', 'forearm_L'],
  ['sleeve_upper_R', 'arm_R'], ['sleeve_lower_R', 'forearm_R'],
] as const;

export type SleeveName = (typeof SLEEVE_JOINTS)[number][0];
export const SLEEVE_NAMES: ReadonlySet<string> = new Set<string>(SLEEVE_JOINTS.map(([s]) => s));

/** upper sleeves ride the upper arms (the first-person view hides those) */
export const isUpperSleeve = (o: Object3D): boolean => o.name.startsWith('sleeve_upper_');

/**
 * Moves an attached outfit's sleeve shells onto the matching body joints (zero local transform), so they bend
 * with the arms instead of hanging in the A-pose from the torso. Returns the moved nodes: they no longer sit under
 * the outfit, so release / hide them alongside it. Outfits without sleeves return [].
 */
export function fitSleeves(outfit: Object3D, body: Object3D): Object3D[] {
  const moved: Object3D[] = [];
  for (const [sleeve, joint] of SLEEVE_JOINTS) {
    const s = findNode(outfit, sleeve);
    const j = findNode(body, joint);
    if (!s || !j) continue;
    j.add(s);
    s.position.set(0, 0, 0);
    s.quaternion.identity();
    s.scale.set(1, 1, 1);
    moved.push(s);
  }
  return moved;
}
