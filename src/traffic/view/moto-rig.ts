import { type Color, type Group, type Material, Matrix4, type Object3D, Vector3 } from 'three';
import { InstancedPart, TintSet } from './instanced-part';
import { VEHICLE_ROLES } from './material-table';
import { type LampAnchors, mergePart, node } from './part-geometry';

export interface MotoPose {
  /** bike frame incl. lean */
  matrix: Matrix4;
  paint: Color;
  paint2: Color;
  brake: number;
  night: number;
  spin: number;
  /** handlebar angle (rad, + = left) */
  steer: number;
}

const m = new Matrix4();
const r = new Matrix4();

/** rest transform of `n` in the model frame */
function rest(modelInv: Matrix4, n: Object3D | null): Matrix4 {
  return n ? new Matrix4().multiplyMatrices(modelInv, n.matrixWorld) : new Matrix4();
}

/**
 * One motorbike model drawn instanced: frame, steering assembly (bars, fork, lamp, mirrors) turning about the
 * headstock, and both wheels rolling. Exposes the seat / grip / peg anchors the NPC riders are posed on.
 */
export class MotoRig {
  readonly tints: TintSet;
  readonly frame: InstancedPart;
  readonly steer: InstancedPart | null;
  readonly wheelF: InstancedPart | null;
  readonly wheelR: InstancedPart | null;
  readonly lamps: Map<string, LampAnchors>;
  /** model-space lamp centres (head lamp rides on the steering assembly, taken at rest) */
  readonly headLamp: Vector3 | null;
  readonly tailLamp: Vector3 | null;
  /** model-space anchors */
  readonly seat = new Vector3(0, 0.87, -0.1);
  readonly pillion = new Vector3(0, 0.88, -0.47);
  readonly grips: [Vector3, Vector3] = [new Vector3(0.27, 1.03, 0.27), new Vector3(-0.27, 1.03, 0.27)];
  readonly wheelRadius: number;
  private readonly steerRest: Matrix4;
  private readonly wheelFRel: Matrix4;
  private readonly wheelRRest: Matrix4;

  constructor(readonly model: string, template: Object3D, material: Material, readonly capacity: number) {
    template.updateMatrixWorld(true);
    const inv = new Matrix4().copy(template.matrixWorld).invert();
    this.tints = new TintSet(capacity);
    const steerNode = node(template, 'steer');
    const fNode = node(template, 'wheel_F');
    const rNode = node(template, 'wheel_R');
    const frame = mergePart(template, template, template, new Set(['steer', 'wheel_R']), VEHICLE_ROLES);
    if (!frame.geometry) throw new Error(`[traffic-view] ${model} has no frame geometry`);
    this.frame = new InstancedPart(frame.geometry, material, capacity, this.tints, `${model}_frame`, true);
    this.lamps = frame.lamps;
    let steerLamps: Map<string, LampAnchors> | null = null;
    const part = (n: Object3D | null, skip: string[], tinted: boolean, name: string): InstancedPart | null => {
      const g = n ? mergePart(template, n, n, new Set(skip), VEHICLE_ROLES) : null;
      if (g && name === 'steer') steerLamps = g.lamps;
      return g?.geometry ? new InstancedPart(g.geometry, material, capacity, tinted ? this.tints : null, `${model}_${name}`, false) : null;
    };
    this.steer = part(steerNode, ['wheel_F'], true, 'steer');
    this.wheelF = part(fNode, [], false, 'wheelF');
    this.wheelR = part(rNode, [], false, 'wheelR');
    this.steerRest = rest(inv, steerNode);
    this.wheelFRel = new Matrix4().copy(this.steerRest).invert().multiply(rest(inv, fNode));
    this.wheelRRest = rest(inv, rNode);
    const centre = (a: LampAnchors | undefined): Vector3 | null => {
      if (!a) return null;
      if (a.left && a.right) return a.left.clone().add(a.right).multiplyScalar(0.5);
      return (a.left ?? a.right)?.clone() ?? null;
    };
    const head = centre((steerLamps as Map<string, LampAnchors> | null)?.get('Light_Head')) ?? null;
    this.headLamp = head ? head.applyMatrix4(this.steerRest) : centre(this.lamps.get('Light_Head'));
    this.tailLamp = centre(this.lamps.get('Light_Tail')) ?? centre(this.lamps.get('Light_Brake'));
    const at = (name: string, out: Vector3): void => {
      const n = node(template, name);
      if (n) out.setFromMatrixPosition(rest(inv, n));
    };
    at('seat_rider', this.seat);
    at('seat_pillion', this.pillion);
    at('grip_L', this.grips[0]);
    at('grip_R', this.grips[1]);
    const wg = this.wheelR?.mesh.geometry;
    wg?.computeBoundingBox();
    this.wheelRadius = wg?.boundingBox ? (wg.boundingBox.max.y - wg.boundingBox.min.y) / 2 : 0.3;
  }

  addTo(group: Group): void {
    for (const p of [this.frame, this.steer, this.wheelF, this.wheelR]) if (p) group.add(p.mesh);
  }

  begin(): void {
    this.frame.begin();
  }

  write(p: MotoPose, animate: boolean): number {
    const i = this.frame.push(p.matrix);
    if (i < 0) return -1;
    this.tints.tint(i, 0, p.paint);
    this.tints.tint(i, 1, p.paint2);
    this.tints.light(i, p.brake, 0, 0, p.night);
    m.multiplyMatrices(p.matrix, this.steerRest);
    if (p.steer !== 0) m.multiply(r.makeRotationY(p.steer));
    this.steer?.setAt(i, m);
    if (this.wheelF) {
      m.multiply(this.wheelFRel);
      if (animate) m.multiply(r.makeRotationX(p.spin));
      this.wheelF.setAt(i, m);
    }
    if (this.wheelR) {
      m.multiplyMatrices(p.matrix, this.wheelRRest);
      if (animate) m.multiply(r.makeRotationX(p.spin));
      this.wheelR.setAt(i, m);
    }
    return i;
  }

  /** indicator lamps of slot i (after write) */
  indicators(i: number, left: number, right: number, brake: number, night: number): void {
    this.tints.light(i, brake, left, right, night);
  }

  commit(): void {
    const n = this.frame.size;
    this.frame.commit(n);
    this.tints.commit(n);
    this.steer?.commit(n);
    this.wheelF?.commit(n);
    this.wheelR?.commit(n);
  }

  dispose(): void {
    for (const p of [this.frame, this.steer, this.wheelF, this.wheelR]) p?.dispose();
  }
}
