import { Box3, Matrix3, Matrix4, type Material, type Mesh, type Object3D, Vector3 } from 'three';
import { isMesh, isStandardMaterial } from '../../../engine/assets/material-guards';
import { MeshBuilder } from '../kit/mesh-builder';
import { copyRange, extractRange, partGeometry } from './geometry-copy';
import {
  baseMaterialName, emissiveOf, isMatte, isSignMaterial, kindCode, MATTE_METAL, SIGNAL_LAMPS, tintOf, TINT,
} from './material-rules';
import type { BakedTemplate, LampColor, SignPart } from './template-types';
import { addPlinth } from './template-plinth';

const rel = new Matrix4();
const nm = new Matrix3();
const tmp = new Vector3();

/** node name of a mesh (a multi-primitive glTF mesh is a Group whose children carry the primitives) */
function nodeName(o: Object3D, root: Object3D): string {
  if (o.parent && o.parent !== root && o.parent.type === 'Group' && !isMesh(o.parent)) return o.parent.name;
  return o.name;
}

interface Range {
  material: Material;
  start: number;
  count: number;
}

function ranges(mesh: Mesh): Range[] {
  const g = mesh.geometry;
  const total = g.getIndex()?.count ?? g.getAttribute('position').count;
  if (!Array.isArray(mesh.material)) return [{ material: mesh.material, start: 0, count: total }];
  const mats = mesh.material;
  return g.groups.map((gr) => ({ material: mats[gr.materialIndex ?? 0], start: gr.start, count: gr.count }));
}

/** extent of a sign face along its own u / v directions (metres) */
function faceSize(part: Omit<SignPart, 'node' | 'width' | 'height'>): [number, number] {
  let best: [number, number] = [1, 1];
  const P = part.positions;
  const U = part.uvs;
  for (let i = 0; i < part.index.length; i += 3) {
    const [a, b, c] = [part.index[i], part.index[i + 1], part.index[i + 2]];
    const du1 = U[b * 2] - U[a * 2];
    const dv1 = U[b * 2 + 1] - U[a * 2 + 1];
    const du2 = U[c * 2] - U[a * 2];
    const dv2 = U[c * 2 + 1] - U[a * 2 + 1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-6) continue;
    const e = (k: number, w1: number, w2: number): number => (P[b * 3 + k] - P[a * 3 + k]) * w1 + (P[c * 3 + k] - P[a * 3 + k]) * w2;
    const tu = [0, 1, 2].map((k) => e(k, dv2 / det, -dv1 / det));
    const tv = [0, 1, 2].map((k) => e(k, -du2 / det, du1 / det));
    best = [Math.hypot(tu[0], tu[1], tu[2]), Math.hypot(tv[0], tv[1], tv[2])];
    break;
  }
  return best;
}

/**
 * Convert a loaded model (Assets.shared clone) into the city's shared representation: one uber geometry with
 * per-vertex colour / roughness / metalness / tint + emissive codes, transparent glass apart, Sign_Face parts for
 * the sign atlas, traffic-light lenses for the signal system, empties as anchors, and a plinth under buildings.
 */
export function bakeTemplate(asset: string, root: Object3D): BakedTemplate {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const mb = new MeshBuilder();
  const glass = new MeshBuilder();
  const signs: SignPart[] = [];
  const lamps: Partial<Record<LampColor, ReturnType<typeof partGeometry>>> = {};
  const anchors = new Map<string, Vector3>();
  let shutter: [number, number] | null = null;
  root.traverse((o) => {
    if (o === root) return;
    rel.multiplyMatrices(inv, o.matrixWorld);
    if (!isMesh(o)) {
      if (o.children.length === 0 && o.name) anchors.set(o.name, new Vector3().setFromMatrixPosition(rel));
      return;
    }
    nm.getNormalMatrix(rel);
    const node = nodeName(o, root);
    const lamp = SIGNAL_LAMPS[node as keyof typeof SIGNAL_LAMPS];
    for (const r of ranges(o)) {
      const m = isStandardMaterial(r.material) ? r.material : null;
      const name = baseMaterialName(r.material.name);
      if (lamp) {
        lamps[lamp] = partGeometry(extractRange(o.geometry, rel, nm, r.start, r.count));
      } else if (isSignMaterial(asset, name)) {
        const raw = extractRange(o.geometry, rel, nm, r.start, r.count);
        const [width, height] = faceSize(raw);
        signs.push({ node, ...raw, width, height });
      } else if (m && m.transparent) {
        glass.linear(m.color.r, m.color.g, m.color.b);
        copyRange(glass, o.geometry, rel, nm, r.start, r.count);
      } else {
        const tint = tintOf(asset, name);
        if (m) mb.linear(m.color.r, m.color.g, m.color.b).surf(m.roughness, isMatte(name) ? MATTE_METAL : m.metalness);
        else mb.color(0xcccccc).surf(0.8, 0);
        mb.kind(kindCode(tint, m ? emissiveOf(m) : 0));
        copyRange(mb, o.geometry, rel, nm, r.start, r.count);
        if (tint === TINT.shutter) shutter = shutterSpan(o, r, rel, shutter);
      }
    }
  });
  if (asset.startsWith('bld_')) addPlinth(mb, asset, root);
  const geometry = mb.toGeometry('uber');
  const bounds = geometry.boundingBox?.clone() ?? new Box3();
  return { name: asset, geometry, glass: glass.isEmpty ? null : glass.toGeometry('glass'), signs, lamps, anchors, bounds, shutter };
}

/** min / max y of the shutter vertices (template space) */
function shutterSpan(o: Mesh, r: Range, m: Matrix4, prev: [number, number] | null): [number, number] {
  const pos = o.geometry.getAttribute('position');
  const index = o.geometry.getIndex();
  let top = prev ? prev[0] : -Infinity;
  let bottom = prev ? prev[1] : Infinity;
  for (let i = r.start; i < r.start + r.count; i++) {
    const v = index ? index.getX(i) : i;
    tmp.fromBufferAttribute(pos, v).applyMatrix4(m);
    top = Math.max(top, tmp.y);
    bottom = Math.min(bottom, tmp.y);
  }
  return [top, bottom];
}
