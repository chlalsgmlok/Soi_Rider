import { BufferAttribute, type BufferGeometry, type Material, Matrix4, type Mesh, type Object3D, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isMesh, isStandardMaterial } from '../../engine/assets/material-guards';
import { contractName, GLOW_ID, type MaterialRole, roleOf } from './material-table';

/** averaged positions of a lamp material in the part frame, split by the model's left (+X) / right (−X) side */
export interface LampAnchors {
  left: Vector3 | null;
  right: Vector3 | null;
}

export interface PartGeometry {
  geometry: BufferGeometry | null;
  /** faces using the `Glass` material, when split off */
  glass: BufferGeometry | null;
  lamps: Map<string, LampAnchors>;
}

const toFrame = new Matrix4();
const toModel = new Matrix4();
const inv = new Matrix4();
const p = new Vector3();

function excluded(o: Object3D, top: Object3D, frame: Object3D, skip: ReadonlySet<string>): boolean {
  for (let n: Object3D | null = o; n && n !== top; n = n.parent) if (n !== frame && skip.has(n.name)) return true;
  return false;
}

/**
 * Instanced NPCs have no morph influences: fold one named shape key in for good (the rain poncho's 'seated' drape —
 * only seated riders wear one) and drop the rest.
 */
function bakeShapeKey(g: BufferGeometry, mesh: Mesh, key: string): void {
  const idx = mesh.morphTargetDictionary?.[key];
  for (const attr of ['position', 'normal'] as const) {
    const morph = idx === undefined ? undefined : g.morphAttributes[attr]?.[idx];
    const base = g.attributes[attr];
    if (!morph || !base) continue;
    for (let i = 0; i < base.count; i++) {
      const x = morph.getX(i);
      const y = morph.getY(i);
      const z = morph.getZ(i);
      if (g.morphTargetsRelative) base.setXYZ(i, base.getX(i) + x, base.getY(i) + y, base.getZ(i) + z);
      else base.setXYZ(i, x, y, z);
    }
  }
  g.morphAttributes = {};
  g.morphTargetsRelative = false;
}

/** clone a mesh's geometry into the frame and bake per-vertex colour / material / glow attributes */
function bake(mesh: Mesh, m: Material, roles: Readonly<Record<string, MaterialRole>>, lamps: Map<string, { l: Vector3; nl: number; r: Vector3; nr: number }>): BufferGeometry {
  const g = mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  bakeShapeKey(g, mesh, 'seated');
  g.applyMatrix4(toFrame);
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  const n = g.attributes.position.count;
  const color = new Float32Array(n * 3);
  const mat = new Float32Array(n * 3);
  const glow = new Float32Array(n * 4);
  const std = isStandardMaterial(m) ? m : null;
  const role = roleOf(roles, m.name);
  const base = std ? std.color : null;
  const em = std ? std.emissive.clone().multiplyScalar(std.emissiveIntensity) : null;
  const gc = role.glowColor ?? (em ? [em.r, em.g, em.b] as const : [0, 0, 0] as const);
  const src = mesh.geometry.attributes.position;
  const lampKey = contractName(m.name);
  const acc = role.glow !== 'static' || lampKey === 'Sign_Taxi' ? lamps.get(lampKey) ?? { l: new Vector3(), nl: 0, r: new Vector3(), nr: 0 } : null;
  for (let i = 0; i < n; i++) {
    const c = role.slot === 0 && base ? base : null;
    color[i * 3] = c ? c.r : 1;
    color[i * 3 + 1] = c ? c.g : 1;
    color[i * 3 + 2] = c ? c.b : 1;
    mat[i * 3] = std ? std.roughness : 0.6;
    mat[i * 3 + 1] = std ? std.metalness : 0;
    mat[i * 3 + 2] = role.slot;
    p.fromBufferAttribute(src, i).applyMatrix4(toModel);
    const left = p.x >= 0;
    const ch = role.glow === 'indicator' ? (left ? GLOW_ID.left : GLOW_ID.right) : GLOW_ID[role.glow];
    glow.set([gc[0], gc[1], gc[2], ch], i * 4);
    if (acc) {
      const q = new Vector3().fromBufferAttribute(g.attributes.position, i);
      if (left) {
        acc.l.add(q);
        acc.nl++;
      } else {
        acc.r.add(q);
        acc.nr++;
      }
    }
  }
  if (acc) lamps.set(lampKey, acc);
  g.setAttribute('color', new BufferAttribute(color, 3));
  g.setAttribute('aMat', new BufferAttribute(mat, 3));
  g.setAttribute('aGlow', new BufferAttribute(glow, 4));
  return g;
}

/**
 * Merge every mesh under `top` into one geometry in the local frame of `frame`, skipping subtrees whose root is
 * named in `skip` (they become parts of their own). `model` is the asset root (decides lamp sides). With
 * `splitGlass`, faces using `Glass` go to a separate geometry for the translucent pass; meshes whose material is in
 * `dropMaterials` are left out (e.g. the street umbrella's concrete foot when a pedestrian carries it).
 */
export function mergePart(
  model: Object3D, top: Object3D, frame: Object3D, skip: ReadonlySet<string>, roles: Readonly<Record<string, MaterialRole>>,
  splitGlass = false, dropMaterials: ReadonlySet<string> | null = null,
): PartGeometry {
  model.updateMatrixWorld(true);
  inv.copy(frame.matrixWorld).invert();
  const modelInv = new Matrix4().copy(model.matrixWorld).invert();
  const opaque: BufferGeometry[] = [];
  const glass: BufferGeometry[] = [];
  const lampAcc = new Map<string, { l: Vector3; nl: number; r: Vector3; nr: number }>();
  top.traverse((o) => {
    if (!isMesh(o) || excluded(o, top, frame, skip)) return;
    toFrame.multiplyMatrices(inv, o.matrixWorld);
    toModel.multiplyMatrices(modelInv, o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats.slice(0, 1)) {
      if (dropMaterials?.has(contractName(m.name))) continue;
      const g = bake(o, m, roles, lampAcc);
      (splitGlass && contractName(m.name) === 'Glass' ? glass : opaque).push(g);
    }
  });
  const lamps = new Map<string, LampAnchors>();
  for (const [k, a] of lampAcc) {
    lamps.set(k, { left: a.nl > 0 ? a.l.divideScalar(a.nl) : null, right: a.nr > 0 ? a.r.divideScalar(a.nr) : null });
  }
  const merge = (list: BufferGeometry[]): BufferGeometry | null => {
    if (list.length === 0) return null;
    const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!g) return null;
    g.computeBoundingSphere();
    for (const x of list) if (x !== g) x.dispose();
    return g;
  };
  return { geometry: merge(opaque), glass: merge(glass), lamps };
}

/** first descendant named `name` (exact GLTF node name) */
export function node(root: Object3D, name: string): Object3D | null {
  return root.getObjectByName(name) ?? null;
}
