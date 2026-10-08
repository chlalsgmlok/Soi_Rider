import { type Color, Euler, type Group, type Material, Matrix4, type Object3D, Quaternion, Vector3 } from 'three';
import { SLEEVE_JOINTS, SLEEVE_NAMES } from '../../engine/assets/outfit-sleeves';
import { InstancedPart, TintSet } from './instanced-part';
import { ATTACHMENT_ROLES, BODY_ROLES } from './material-table';
import { mergePart, node } from './part-geometry';

/** char_body joints, parents first (docs/ASSET_SPEC.md segmented rig) */
export const JOINTS = [
  'hips', 'torso', 'head', 'arm_L', 'forearm_L', 'hand_L', 'arm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R',
] as const;
export type JointName = (typeof JOINTS)[number];
export const J = Object.fromEntries(JOINTS.map((n, i) => [n, i])) as Record<JointName, number>;
const PARENT = [-1, 0, 1, 1, 3, 4, 1, 6, 7, 0, 9, 10, 0, 12, 13];
/** Euler angles (x, y, z) per joint, rad — written by character-pose.ts */
export type PoseBuffer = Float32Array;
export const createPose = (): PoseBuffer => new Float32Array(JOINTS.length * 3);

export type HeadGear = 'hair_short' | 'hair_long' | 'hair_bun' | 'hat_cap' | 'helmet_open' | 'helmet_full' | 'helmet_half' | 'helmet_cat';
export type TorsoGear = 'outfit_vest' | 'outfit_hood' | 'outfit_jacket' | 'outfit_poncho';
export const HEAD_GEAR: readonly HeadGear[] = ['hair_short', 'hair_long', 'hair_bun', 'hat_cap', 'helmet_open', 'helmet_full', 'helmet_half', 'helmet_cat'];
export const TORSO_GEAR: readonly TorsoGear[] = ['outfit_vest', 'outfit_hood', 'outfit_jacket', 'outfit_poncho'];
export const UMBRELLA = 'prop_umbrella';
const UMBRELLA_SCALE = 0.38;
/** the street umbrella's weighted foot is not carried around */
const UMBRELLA_DROP: ReadonlySet<string> = new Set(['Concrete', 'Tire']);

export interface CharacterLook {
  skin: Color;
  shirt: Color;
  pants: Color;
  hair: Color;
  head: HeadGear | null;
  headColor: Color;
  torso: TorsoGear | null;
  torsoColor: Color;
  umbrella: boolean;
  umbrellaColor: Color;
}

const world: Matrix4[] = JOINTS.map(() => new Matrix4());
const local = new Matrix4();
const rot = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const um = new Matrix4();
const v3 = new Vector3();

/** one attachment kind drawn instanced (own tint for its main material): the subtree `top` minus `skip`, in its frame */
class Gear {
  readonly tints: TintSet;
  readonly part: InstancedPart;
  constructor(
    name: string, template: Object3D, material: Material, capacity: number, top = template, skip: ReadonlySet<string> = new Set(),
    drop: ReadonlySet<string> | null = null,
  ) {
    this.tints = new TintSet(capacity);
    const g = mergePart(template, top, top, skip, ATTACHMENT_ROLES, false, drop).geometry;
    if (!g) throw new Error(`[traffic-view] ${name} has no geometry`);
    this.part = new InstancedPart(g, material, capacity, this.tints, `npc_${name}`, false);
  }
  write(m: Matrix4, c: Color): void {
    const i = this.part.push(m);
    if (i >= 0) this.tints.tint(i, 0, c);
  }
}

/**
 * Every NPC person (walkers, vendors, monks, motorbike riders, drivers) as one instanced segmented rig: the 15
 * char_body segments share their slot order and tints (skin, shirt, pants, hair); hair / hats / helmets / outfits
 * / umbrellas are instanced per kind and follow the head, torso or right hand.
 */
export class CharacterRig {
  readonly tints: TintSet;
  readonly parts: InstancedPart[] = [];
  private readonly rest: Matrix4[] = [];
  private readonly gear = new Map<string, Gear>();
  /** per outfit: its sleeve shells, each drawn on the arm / forearm joint it follows */
  private readonly sleeves = new Map<string, Array<[Gear, number]>>();

  constructor(body: Object3D, gear: ReadonlyMap<string, Object3D>, material: Material, readonly capacity: number) {
    body.updateMatrixWorld(true);
    this.tints = new TintSet(capacity);
    const skip = new Set<string>(JOINTS);
    const shadowed = new Set<string>(['hips', 'torso', 'head', 'thigh_L', 'thigh_R']);
    JOINTS.forEach((name, i) => {
      const n = node(body, name);
      if (!n) throw new Error(`[traffic-view] char_body lacks ${name}`);
      const parent = PARENT[i] < 0 ? body : node(body, JOINTS[PARENT[i]]);
      this.rest.push(new Matrix4().copy(parent?.matrixWorld ?? body.matrixWorld).invert().multiply(n.matrixWorld));
      const g = mergePart(body, n, n, skip, BODY_ROLES).geometry;
      if (!g) throw new Error(`[traffic-view] char_body ${name} has no mesh`);
      this.parts.push(new InstancedPart(g, material, capacity, this.tints, `npc_${name}`, shadowed.has(name)));
    });
    for (const [name, t] of gear) {
      // sleeves leave the torso part and become per-joint parts (blender/assets/characters/README.md › Attachments)
      this.gear.set(name, new Gear(name, t, material, capacity, t, SLEEVE_NAMES, name === UMBRELLA ? UMBRELLA_DROP : null));
      const own: Array<[Gear, number]> = [];
      for (const [sleeve, joint] of SLEEVE_JOINTS) {
        const s = node(t, sleeve);
        if (s) own.push([new Gear(`${name}_${sleeve}`, t, material, capacity, s), J[joint]]);
      }
      if (own.length > 0) this.sleeves.set(name, own);
    }
  }

  /** every instanced gear part: attachments and their sleeves */
  private *gearParts(): Generator<Gear> {
    yield* this.gear.values();
    for (const list of this.sleeves.values()) for (const [g] of list) yield g;
  }

  addTo(group: Group): void {
    for (const p of this.parts) group.add(p.mesh);
    for (const g of this.gearParts()) group.add(g.part.mesh);
  }

  begin(): void {
    for (const p of this.parts) p.begin();
    for (const g of this.gearParts()) g.part.begin();
  }

  /** append one person: root = feet-on-ground frame (heading, position); pose = joint Euler angles */
  write(root: Matrix4, heading: number, pose: PoseBuffer, look: CharacterLook): void {
    for (let j = 0; j < JOINTS.length; j++) {
      const x = pose[j * 3];
      const y = pose[j * 3 + 1];
      const z = pose[j * 3 + 2];
      local.copy(this.rest[j]);
      if (x !== 0 || y !== 0 || z !== 0) local.multiply(rot.makeRotationFromQuaternion(q.setFromEuler(e.set(x, y, z))));
      world[j].multiplyMatrices(PARENT[j] < 0 ? root : world[PARENT[j]], local);
    }
    const i = this.parts[0].push(world[0]);
    if (i < 0) return;
    for (let j = 1; j < JOINTS.length; j++) this.parts[j].setAt(i, world[j]);
    this.tints.tint(i, 0, look.skin);
    this.tints.tint(i, 1, look.shirt);
    this.tints.tint(i, 2, look.pants);
    this.tints.tint(i, 3, look.hair);
    if (look.head) this.gear.get(look.head)?.write(world[J.head], look.headColor);
    if (look.torso) {
      this.gear.get(look.torso)?.write(world[J.torso], look.torsoColor);
      for (const [g, j] of this.sleeves.get(look.torso) ?? []) g.write(world[j], look.torsoColor);
    }
    if (look.umbrella) {
      v3.setFromMatrixPosition(world[J.hand_R]);
      um.makeRotationY(heading).setPosition(v3).multiply(rot.makeScale(UMBRELLA_SCALE, UMBRELLA_SCALE, UMBRELLA_SCALE));
      um.multiply(rot.makeTranslation(0, -0.62, 0));
      this.gear.get(UMBRELLA)?.write(um, look.umbrellaColor);
    }
  }

  commit(): void {
    const n = this.parts[0].size;
    for (const p of this.parts) p.commit(n);
    this.tints.commit(n);
    for (const g of this.gearParts()) {
      g.part.commit();
      g.tints.commit(g.part.size);
    }
  }

  get count(): number {
    return this.parts[0].size;
  }

  dispose(): void {
    for (const p of this.parts) p.dispose();
    for (const g of this.gearParts()) g.part.dispose();
  }
}
