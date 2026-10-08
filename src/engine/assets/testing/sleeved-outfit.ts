/** Test fixture: a sleeved outfit authored like outfit_hood / outfit_jacket.glb (see outfit-sleeves.ts). */
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { SLEEVE_JOINTS } from '../outfit-sleeves';

const paint = new MeshStandardMaterial({ name: 'Outfit_Paint' });

/** an outfit authored like outfit_jacket.glb: root at the torso pivot, sleeves at the arm / forearm pivots (torso frame) */
export function sleevedOutfit(body: Object3D, name = 'outfit_jacket'): Group {
  body.updateMatrixWorld(true);
  const torso = body.getObjectByName('torso') as Object3D;
  const toTorso = new Matrix4().copy(torso.matrixWorld).invert();
  const outfit = new Group();
  outfit.name = name;
  outfit.add(new Mesh(new BoxGeometry(0.38, 0.44, 0.24).translate(0, 0.2, 0), paint));
  for (const [sleeve, joint] of SLEEVE_JOINTS) {
    const s = new Mesh(new BoxGeometry(0.1, 0.26, 0.1).translate(0, -0.13, 0), paint);
    s.name = sleeve;
    s.position.setFromMatrixPosition((body.getObjectByName(joint) as Object3D).matrixWorld).applyMatrix4(toTorso);
    outfit.add(s);
  }
  return outfit;
}
