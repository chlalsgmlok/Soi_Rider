import { type Color, type Group, type Material, Matrix4, type Object3D, Quaternion, Vector3 } from 'three';
import { InstancedPart, TintSet } from './instanced-part';
import { VEHICLE_ROLES } from './material-table';
import { type LampAnchors, mergePart, node } from './part-geometry';

const WHEEL_NAMES = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR', 'wheel_F'];
const SKIP = new Set([...WHEEL_NAMES, 'mirror_L', 'mirror_R']);
/** mirror fold angle at full fold (rad) */
const FOLD = 1.25;

interface WheelSlot {
  pos: Vector3;
  right: boolean;
  front: boolean;
}

/** per-vehicle pose inputs for one frame */
export interface VehiclePose {
  matrix: Matrix4;
  paint: Color;
  paint2: Color;
  brake: number;
  left: number;
  right: number;
  night: number;
  /** wheel roll angle (rad) and front-wheel steer (rad, + = left) */
  spin: number;
  steer: number;
  /** 0..1 fold of the left / right mirror */
  foldL: number;
  foldR: number;
}

const m = new Matrix4();
const r = new Matrix4();
const q = new Quaternion();
const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const flip = new Matrix4().makeRotationY(Math.PI);

/**
 * One four-wheeled model drawn instanced: body (all static nodes merged, Paint → tint A, Paint2 → tint B, lamps
 * driven per instance), translucent glass, four wheels sharing one geometry (spin + steer), and both mirrors on
 * their hinges (fold when clipped). Slots are refilled every frame.
 */
export class VehicleRig {
  readonly tints: TintSet;
  readonly body: InstancedPart;
  readonly glass: InstancedPart | null;
  readonly wheels: InstancedPart | null;
  readonly mirrors: Array<{ part: InstancedPart; rest: Matrix4; dir: number }> = [];
  readonly lamps: Map<string, LampAnchors>;
  readonly wheelRadius: number;
  private readonly slots: WheelSlot[] = [];
  private readonly wheelRest = new Quaternion();

  constructor(readonly model: string, template: Object3D, material: Material, glassMaterial: Material, readonly capacity: number) {
    template.updateMatrixWorld(true);
    const modelInv = new Matrix4().copy(template.matrixWorld).invert();
    this.tints = new TintSet(capacity);
    const body = mergePart(template, template, template, SKIP, VEHICLE_ROLES, true);
    if (!body.geometry) throw new Error(`[traffic-view] ${model} has no body geometry`);
    this.body = new InstancedPart(body.geometry, material, capacity, this.tints, `${model}_body`, true);
    this.lamps = body.lamps;
    this.glass = body.glass ? new InstancedPart(body.glass, glassMaterial, capacity, null, `${model}_glass`, false) : null;
    if (this.glass) this.glass.mesh.instanceMatrix = this.body.mesh.instanceMatrix;
    const wheelNodes = WHEEL_NAMES.map((n) => node(template, n)).filter((n): n is Object3D => n !== null);
    const ref = wheelNodes.find((n) => n.name === 'wheel_RL') ?? wheelNodes[0];
    let radius = 0.33;
    if (ref) {
      const g = mergePart(template, ref, ref, new Set(), VEHICLE_ROLES).geometry;
      if (g) {
        g.computeBoundingBox();
        const bb = g.boundingBox;
        if (bb) radius = (bb.max.y - bb.min.y) / 2;
        this.wheels = new InstancedPart(g, material, capacity * 4, null, `${model}_wheels`, false);
      } else this.wheels = null;
      new Matrix4().multiplyMatrices(modelInv, ref.matrixWorld).decompose(new Vector3(), this.wheelRest, new Vector3());
      for (const w of wheelNodes) {
        const pos = new Vector3().setFromMatrixPosition(new Matrix4().multiplyMatrices(modelInv, w.matrixWorld));
        this.slots.push({ pos, right: pos.x < -0.05, front: w.name.charAt(6) === 'F' });
      }
    } else this.wheels = null;
    this.wheelRadius = radius;
    for (const [name, dir] of [['mirror_L', 1], ['mirror_R', -1]] as const) {
      const n = node(template, name);
      const g = n ? mergePart(template, n, n, new Set(), VEHICLE_ROLES).geometry : null;
      if (!n || !g) continue;
      const part = new InstancedPart(g, material, capacity, this.tints, `${model}_${name}`, false);
      this.mirrors.push({ part, rest: new Matrix4().multiplyMatrices(modelInv, n.matrixWorld), dir });
    }
  }

  addTo(group: Group): void {
    group.add(this.body.mesh);
    if (this.glass) group.add(this.glass.mesh);
    if (this.wheels) group.add(this.wheels.mesh);
    for (const mi of this.mirrors) group.add(mi.part.mesh);
  }

  begin(): void {
    this.body.begin();
    this.wheels?.begin();
    for (const mi of this.mirrors) mi.part.begin();
  }

  /** append one vehicle; returns false when the rig is full */
  write(p: VehiclePose, animate: boolean): boolean {
    const i = this.body.push(p.matrix);
    if (i < 0) return false;
    this.tints.tint(i, 0, p.paint);
    this.tints.tint(i, 1, p.paint2);
    this.tints.light(i, p.brake, p.left, p.right, p.night);
    for (const mi of this.mirrors) {
      m.multiplyMatrices(p.matrix, mi.rest);
      if (p.foldL > 0 || p.foldR > 0) m.multiply(r.makeRotationY(mi.dir * FOLD * (mi.dir > 0 ? p.foldL : p.foldR)));
      mi.part.setAt(i, m);
    }
    if (this.wheels) {
      for (const w of this.slots) {
        m.copy(p.matrix).multiply(r.makeTranslation(w.pos.x, w.pos.y, w.pos.z));
        if (w.front && p.steer !== 0) m.multiply(r.makeRotationAxis(Y, p.steer));
        if (w.right) m.multiply(flip);
        m.multiply(r.makeRotationFromQuaternion(this.wheelRest));
        if (animate) m.multiply(r.makeRotationFromQuaternion(q.setFromAxisAngle(X, w.right ? -p.spin : p.spin)));
        this.wheels.push(m);
      }
    }
    return true;
  }

  commit(): void {
    const n = this.body.size;
    this.body.commit(n);
    this.glass?.commit(n);
    this.tints.commit(n);
    this.wheels?.commit();
    for (const mi of this.mirrors) mi.part.commit(n);
  }

  dispose(): void {
    this.body.dispose();
    this.glass?.dispose();
    this.wheels?.dispose();
    for (const mi of this.mirrors) mi.part.dispose();
  }
}
