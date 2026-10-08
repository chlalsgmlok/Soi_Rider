import { type Group, type Matrix4, type Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fitSleeves, isUpperSleeve, SLEEVE_JOINTS } from './outfit-sleeves';
import { buildPlaceholder } from './placeholders/placeholder-registry';
import { sleevedOutfit } from './testing/sleeved-outfit';

const close = (a: Matrix4, b: Matrix4): void => {
  a.elements.forEach((v, i) => expect(v).toBeCloseTo(b.elements[i], 5));
};

describe('outfit sleeves', () => {
  it('moves each sleeve onto its joint with a zero local transform, so it follows the posed arm', () => {
    const body = buildPlaceholder('char_body') as Group;
    const outfit = sleevedOutfit(body);
    (body.getObjectByName('torso') as Object3D).add(outfit);
    body.updateMatrixWorld(true);
    const restWorld = new Vector3().setFromMatrixPosition((outfit.getObjectByName('sleeve_lower_L') as Object3D).matrixWorld);

    const moved = fitSleeves(outfit, body);
    expect(moved.map((s) => s.name).sort()).toEqual(SLEEVE_JOINTS.map(([s]) => s).sort());
    for (const [sleeve, joint] of SLEEVE_JOINTS) {
      const s = moved.find((o) => o.name === sleeve) as Object3D;
      expect(s.parent?.name).toBe(joint);
      expect(s.position.lengthSq()).toBe(0);
      expect(s.quaternion.w).toBe(1);
      expect(outfit.getObjectByName(sleeve)).toBeUndefined();
    }
    body.updateMatrixWorld(true);
    // unposed, the sleeve sits exactly where the outfit authored it
    expect(new Vector3().setFromMatrixPosition((body.getObjectByName('sleeve_lower_L') as Object3D).matrixWorld).distanceTo(restWorld)).toBeLessThan(1e-6);

    // riding pose: arms reach forward, sleeves go with them (they used to hang in the A-pose from the torso)
    for (const side of ['L', 'R']) {
      (body.getObjectByName(`arm_${side}`) as Object3D).rotation.set(-1.0, 0, side === 'L' ? -0.12 : 0.12);
      (body.getObjectByName(`forearm_${side}`) as Object3D).rotation.set(-0.45, 0, 0);
    }
    body.updateMatrixWorld(true);
    for (const [sleeve, joint] of SLEEVE_JOINTS) {
      close((body.getObjectByName(sleeve) as Object3D).matrixWorld, (body.getObjectByName(joint) as Object3D).matrixWorld);
    }
    expect(moved.filter(isUpperSleeve).map((s) => s.name).sort()).toEqual(['sleeve_upper_L', 'sleeve_upper_R']);
  });

  it('leaves sleeveless outfits alone', () => {
    const body = buildPlaceholder('char_body') as Group;
    const vest = buildPlaceholder('outfit_vest') as Group;
    (body.getObjectByName('torso') as Object3D).add(vest);
    const children = vest.children.length;
    expect(fitSleeves(vest, body)).toEqual([]);
    expect(vest.children.length).toBe(children);
  });
});
