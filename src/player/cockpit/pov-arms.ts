import {
  type BufferGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type Object3D, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { findNode } from '../../engine/assets/material-tools';
import { toonify } from '../../engine/env/toonify';

const UP = new Vector3(0, 1, 0);
const SLEEVE_SHADE = new Color('#1d1f26');
const tmp = new Vector3();

/** the joints the cockpit arms follow ([left, right]) */
export interface ArmJoints {
  forearm: [Object3D, Object3D];
  hand: [Object3D, Object3D];
}

function mat(name: string, hex: string, roughness: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ name, color: hex, roughness, metalness: 0 });
  toonify(m);
  return m;
}

/**
 * First-person arms (mockup 02). At POV distance the stylised body forearms read as flat planks, so the cockpit
 * swaps in chunkier stand-ins: a tapered, rounded jacket sleeve with a contrasting cuff on each IK-posed forearm,
 * and a padded riding glove (knuckle armour + thumb) clenched around each grip of the bike (grip_L / grip_R).
 * Lives in plain Groups under the joints, so FirstPersonMask (which hides direct mesh children) leaves it alone.
 */
export class PovArms {
  private readonly sleeve = mat('Pov_Sleeve', '#3c6fd1', 0.8);
  private readonly cuff = mat('Pov_Cuff', '#f3f1ec', 0.75);
  private readonly glove = mat('Pov_Glove', '#25272d', 0.9);
  private readonly pad = mat('Pov_Pad', '#6b707c', 0.55);
  private readonly groups: Group[] = [];
  private readonly gloves: Group[] = [];
  private readonly hands: Object3D[];
  private readonly geos: BufferGeometry[] = [];

  constructor(j: ArmJoints) {
    this.hands = [j.hand[0], j.hand[1]];
    for (let i = 0; i < 2; i++) {
      this.groups.push(this.buildSleeve(j.forearm[i], j.hand[i].position));
      const glove = this.buildGlove(i === 0 ? 1 : -1);
      j.hand[i].add(glove);
      this.gloves.push(glove);
      this.groups.push(glove);
    }
    this.setVisible(false);
  }

  /** clench the gloves around this bike's grips (call after every bike swap); falls back to the hands */
  bindGrips(bike: Object3D): void {
    this.gloves.forEach((g, i) => {
      const grip = findNode(bike, i === 0 ? 'grip_L' : 'grip_R');
      (grip ?? this.hands[i]).add(g);
    });
  }

  setVisible(on: boolean): void {
    for (const g of this.groups) g.visible = on;
  }

  /**
   * sleeve = what covers the rider's forearms (outfit / tee colour), deepened like the UV arm covers Bangkok
   * riders wear so the bright gloves-on-grips read first (mockup 02); gloves stay black
   */
  setColors(sleeveHex: string, cuffHex: string): void {
    this.sleeve.color.set(sleeveHex).lerp(SLEEVE_SHADE, 0.38);
    this.cuff.color.set(cuffHex);
  }

  dispose(): void {
    for (const g of this.groups) g.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of [this.sleeve, this.cuff, this.glove, this.pad]) m.dispose();
  }

  private keep<T extends BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  /** a tapered tube from the elbow (forearm origin) to the wrist (hand origin, in forearm space) plus a cuff */
  private buildSleeve(forearm: Object3D, wrist: Vector3): Group {
    const g = new Group();
    g.name = 'pov_sleeve';
    const len = Math.max(0.12, wrist.length());
    const dir = tmp.copy(wrist).normalize();
    const q = new Quaternion().setFromUnitVectors(UP, dir);
    const tube = new Mesh(this.keep(new CylinderGeometry(0.038, 0.05, len * 0.82, 14, 1)), this.sleeve);
    tube.position.copy(dir).multiplyScalar(len * 0.41);
    tube.quaternion.copy(q);
    const elbow = new Mesh(this.keep(new SphereGeometry(0.05, 14, 10)), this.sleeve);
    const cuff = new Mesh(this.keep(new CylinderGeometry(0.042, 0.042, 0.045, 14, 1)), this.cuff);
    cuff.position.copy(dir).multiplyScalar(len * 0.8);
    cuff.quaternion.copy(q);
    g.add(tube, elbow, cuff);
    forearm.add(g);
    return g;
  }

  /**
   * a fist clenched round the grip, in grip space (steer frame: X along the bar, Y up, Z forward); side +1 = left
   * grip (the bike centre is toward −X), −1 = right
   */
  private buildGlove(side: number): Group {
    const g = new Group();
    g.name = 'pov_glove';
    const fist = new Mesh(this.keep(new RoundedBoxGeometry(0.12, 0.1, 0.11, 3, 0.036)), this.glove);
    fist.position.set(0, 0.016, -0.012);
    const knuckles = new Mesh(this.keep(new RoundedBoxGeometry(0.1, 0.03, 0.065, 2, 0.012)), this.pad);
    knuckles.position.set(0, 0.07, 0.0);
    knuckles.rotation.x = -0.35;
    const thumb = new Mesh(this.keep(new CylinderGeometry(0.017, 0.021, 0.06, 10, 1)), this.glove);
    thumb.position.set(-0.05 * side, 0.03, 0.025);
    thumb.rotation.set(1.1, 0, 0.4 * side);
    g.add(fist, knuckles, thumb);
    return g;
  }
}
