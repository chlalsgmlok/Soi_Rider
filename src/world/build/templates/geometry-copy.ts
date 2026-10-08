import { BufferAttribute, BufferGeometry, type Matrix3, type Matrix4, Vector3 } from 'three';
import type { MeshBuilder } from '../kit/mesh-builder';

const p = new Vector3();
const n = new Vector3();

/** triangle-corner index list of a draw range (indexed or not) */
function cornerIndices(g: BufferGeometry, start: number, count: number): ArrayLike<number> & { length: number } {
  const index = g.getIndex();
  const total = index ? index.count : g.getAttribute('position').count;
  const end = Math.min(total, start + count);
  if (index) return index.array.subarray(start, end);
  const out = new Uint32Array(Math.max(0, end - start));
  for (let i = 0; i < out.length; i++) out[i] = start + i;
  return out;
}

/** copy the triangles of a draw range into the builder (current colour / kind / surface), transformed by m */
export function copyRange(mb: MeshBuilder, g: BufferGeometry, m: Matrix4, nm: Matrix3, start: number, count: number): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const remap = new Map<number, number>();
  const corners = cornerIndices(g, start, count);
  const out: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const src = corners[i];
    let dst = remap.get(src);
    if (dst === undefined) {
      p.fromBufferAttribute(pos, src).applyMatrix4(m);
      if (nor) n.fromBufferAttribute(nor, src).applyMatrix3(nm).normalize();
      else n.set(0, 1, 0);
      dst = mb.vert(p.x, p.y, p.z, n.x, n.y, n.z);
      remap.set(src, dst);
    }
    out.push(dst);
  }
  for (let i = 0; i + 2 < out.length; i += 3) mb.tri(out[i], out[i + 1], out[i + 2]);
}

export interface RawPart {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  index: Uint32Array;
}

/** extract a draw range as a standalone part (positions / normals / uvs in template space) */
export function extractRange(g: BufferGeometry, m: Matrix4, nm: Matrix3, start: number, count: number): RawPart {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const corners = cornerIndices(g, start, count);
  const remap = new Map<number, number>();
  const P: number[] = [];
  const N: number[] = [];
  const U: number[] = [];
  const I: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const src = corners[i];
    let dst = remap.get(src);
    if (dst === undefined) {
      dst = P.length / 3;
      p.fromBufferAttribute(pos, src).applyMatrix4(m);
      if (nor) n.fromBufferAttribute(nor, src).applyMatrix3(nm).normalize();
      else n.set(0, 0, 1);
      P.push(p.x, p.y, p.z);
      N.push(n.x, n.y, n.z);
      U.push(uv ? uv.getX(src) : 0, uv ? uv.getY(src) : 0);
      remap.set(src, dst);
    }
    I.push(dst);
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(U), index: new Uint32Array(I) };
}

/** a RawPart as a position + normal BufferGeometry */
export function partGeometry(part: RawPart): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(part.positions, 3));
  g.setAttribute('normal', new BufferAttribute(part.normals, 3));
  g.setIndex(new BufferAttribute(part.index, 1));
  g.computeBoundingSphere();
  return g;
}
