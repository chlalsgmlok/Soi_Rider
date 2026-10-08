import {
  type BufferGeometry, CylinderGeometry, Euler, Group, type Material, Matrix4, Mesh, Object3D, Quaternion,
  SphereGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { placeholderMaterial } from './materials';

export type V3 = readonly [number, number, number];
type Axis = 'x' | 'y' | 'z';

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const s1 = new Vector3(1, 1, 1);
const pos = new Vector3();

/**
 * Builds a coarse stand-in model with the runtime node/material contract of docs/ASSET_SPEC.md.
 * All coordinates are MODEL space in three.js axes (+Z forward, +X = model's left, +Y up, metres).
 * Nodes are positioned at their pivots; parts are merged per (node, material) to keep draw calls low.
 */
export class PlaceholderKit {
  readonly root: Group;
  private readonly nodes = new Map<string, { obj: Object3D; pivot: Vector3 }>();
  private readonly parts = new Map<Object3D, Map<string, BufferGeometry[]>>();
  private readonly mats = new Map<string, Material>();
  private readonly colors = new Map<string, string>();

  constructor(name: string) {
    this.root = new Group();
    this.root.name = name;
    this.nodes.set('', { obj: this.root, pivot: new Vector3() });
  }

  /** override the default colour of a material for this model */
  color(material: string, hex: string): this {
    this.colors.set(material, hex);
    return this;
  }

  /** named node (pivot in model space) under `parent` ('' = root). Also used for empties. */
  node(name: string, pivot: V3 = [0, 0, 0], parent = ''): this {
    const p = this.nodes.get(parent);
    if (!p) throw new Error(`[placeholder] parent node "${parent}" missing for "${name}"`);
    const obj = new Object3D();
    obj.name = name;
    const pv = new Vector3(...pivot);
    obj.position.copy(pv).sub(p.pivot);
    p.obj.add(obj);
    this.nodes.set(name, { obj, pivot: pv });
    return this;
  }

  /** rounded box centred at `c` (model space) */
  box(node: string, mat: string, size: V3, c: V3, radius = 0.04, rot: V3 = [0, 0, 0]): this {
    const r = Math.min(radius, size[0] / 2.01, size[1] / 2.01, size[2] / 2.01);
    const g = r > 0.004 ? new RoundedBoxGeometry(size[0], size[1], size[2], 1, r) : new RoundedBoxGeometry(...size, 1, 0.001);
    return this.add(node, mat, g, c, rot);
  }

  /** cylinder along `axis`, centred at `c` */
  cyl(node: string, mat: string, rTop: number, rBottom: number, length: number, c: V3, axis: Axis = 'y', seg = 12): this {
    const g = new CylinderGeometry(rTop, rBottom, length, seg);
    const rot: V3 = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    return this.add(node, mat, g, c, rot);
  }

  /** ellipsoid (sphere scaled by `scale`) */
  ball(node: string, mat: string, radius: number, c: V3, scale: V3 = [1, 1, 1], seg = 12): this {
    const g = new SphereGeometry(radius, seg, Math.max(6, Math.round(seg * 0.6)));
    g.scale(...scale);
    return this.add(node, mat, g, c, [0, 0, 0]);
  }

  /** flat quad facing +Z (for Sign_Face / Dash_Screen canvas targets, UV 0..1) */
  quad(node: string, mat: string, w: number, h: number, c: V3, rot: V3 = [0, 0, 0]): this {
    const g = new RoundedBoxGeometry(w, h, 0.01, 1, 0.001);
    return this.add(node, mat, g, c, rot);
  }

  build(): Group {
    for (const [obj, byMat] of this.parts) {
      for (const [matName, geoms] of byMat) {
        const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
        if (geoms.length > 1) for (const g of geoms) g.dispose();
        const mesh = new Mesh(merged, this.material(matName));
        mesh.name = obj === this.root ? `${this.root.name}_${matName}` : `${obj.name}_${matName}`;
        obj.add(mesh);
      }
    }
    this.parts.clear();
    return this.root;
  }

  private material(name: string): Material {
    let m = this.mats.get(name);
    if (!m) {
      m = placeholderMaterial(name, this.colors.get(name));
      this.mats.set(name, m);
    }
    return m;
  }

  private add(node: string, mat: string, src: BufferGeometry, c: V3, rot: V3): this {
    const n = this.nodes.get(node);
    if (!n) throw new Error(`[placeholder] node "${node}" missing in ${this.root.name}`);
    // RoundedBoxGeometry is non-indexed; normalise everything so parts can merge
    const g = src.index ? src.toNonIndexed() : src;
    if (g !== src) src.dispose();
    q.setFromEuler(e.set(rot[0], rot[1], rot[2]));
    pos.set(c[0] - n.pivot.x, c[1] - n.pivot.y, c[2] - n.pivot.z);
    g.applyMatrix4(m4.compose(pos, q, s1));
    let byMat = this.parts.get(n.obj);
    if (!byMat) {
      byMat = new Map();
      this.parts.set(n.obj, byMat);
    }
    const list = byMat.get(mat) ?? [];
    list.push(g);
    byMat.set(mat, list);
    return this;
  }
}
