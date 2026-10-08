import { Box3, Color, Group, type InstancedMesh, Matrix4, MeshStandardMaterial, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { sleevedOutfit } from '../../engine/assets/testing/sleeved-outfit';
import { buildPlaceholder } from '../../engine/assets/placeholders/placeholder-registry';
import { type CharacterLook, CharacterRig, createPose, J } from './character-rig';

const white = new Color('#ffffff');
const look = (torso: CharacterLook['torso']): CharacterLook => ({
  skin: white, shirt: white, pants: white, hair: white, head: null, headColor: white, torso, torsoColor: new Color('#2b3a5c'),
  umbrella: false, umbrellaColor: white,
});

function rig(): { rig: CharacterRig; meshes: Map<string, InstancedMesh> } {
  const body = buildPlaceholder('char_body') as Group;
  const jacket = sleevedOutfit(buildPlaceholder('char_body') as Group);
  const r = new CharacterRig(body, new Map<string, Object3D>([['outfit_jacket', jacket]]), new MeshStandardMaterial(), 4);
  const g = new Group();
  r.addTo(g);
  const meshes = new Map(g.children.map((m) => [m.name, m as InstancedMesh]));
  return { rig: r, meshes };
}

const at = (m: InstancedMesh, i: number): Matrix4 => {
  const out = new Matrix4();
  m.getMatrixAt(i, out);
  return out;
};

describe('NPC character rig: outfit sleeves', () => {
  it('draws hoodie / jacket sleeves on the arm and forearm joints, not frozen on the torso', () => {
    const { rig: r, meshes } = rig();
    const torsoPart = meshes.get('npc_outfit_jacket') as InstancedMesh;
    torsoPart.geometry.computeBoundingBox();
    // the torso part no longer carries the A-pose sleeves (they reached out to x = ±0.29)
    expect((torsoPart.geometry.boundingBox as Box3).max.x).toBeLessThan(0.2);
    // each sleeve part is authored in its joint frame (origin at the shoulder / elbow, hanging down)
    const upper = meshes.get('npc_outfit_jacket_sleeve_upper_L') as InstancedMesh;
    upper.geometry.computeBoundingBox();
    expect((upper.geometry.boundingBox as Box3).max.y).toBeCloseTo(0, 5);
    expect((upper.geometry.boundingBox as Box3).min.y).toBeCloseTo(-0.26, 5);

    const pose = createPose();
    pose[J.arm_L * 3] = -1.0;
    pose[J.forearm_L * 3] = -0.45;
    pose[J.arm_R * 3] = -1.0;
    pose[J.forearm_R * 3] = -0.45;
    r.begin();
    r.write(new Matrix4().makeTranslation(3, 0, -2), 0, pose, look(null));
    r.write(new Matrix4().makeTranslation(-1, 0, 5), 0.5, pose, look('outfit_jacket'));
    r.commit();

    expect(torsoPart.count).toBe(1);
    const pairs = [['sleeve_upper_L', 'arm_L'], ['sleeve_lower_L', 'forearm_L'], ['sleeve_upper_R', 'arm_R'], ['sleeve_lower_R', 'forearm_R']];
    for (const [sleeve, joint] of pairs) {
      const s = meshes.get(`npc_outfit_jacket_${sleeve}`) as InstancedMesh;
      expect(s.count).toBe(1);
      // person #1 wears the jacket: its sleeve instance equals that person's posed joint matrix
      const a = at(s, 0).elements;
      const b = at(meshes.get(`npc_${joint}`) as InstancedMesh, 1).elements;
      a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 5));
    }
  });
});
