import { Matrix3, type Matrix4, Vector3 } from 'three';
import type { UvRect } from '../markings/markings-atlas';
import type { MeshBuilder, P3 } from '../kit/mesh-builder';
import type { SignPart } from '../templates/template-types';
import type { FaceRect } from './sign-content';

const v = new Vector3();
const n = new Vector3();
const nm = new Matrix3();
/** signs float this far in front of whatever they are mounted on */
const LIFT = 0.012;

/**
 * A model's Sign_Face part, placed by `m`, with its 0..1 UVs remapped into the atlas cell. glTF UVs have v = 0 at the
 * TOP of the face (Blender's v is flipped on export), the atlas rect's v0 is its bottom edge.
 */
export function emitPart(mb: MeshBuilder, part: SignPart, m: Matrix4, rect: UvRect, board: string, glow: number, lift = LIFT): void {
  nm.getNormalMatrix(m);
  mb.color(board).kind(glow);
  const base = mb.vertexCount;
  const [u0, v0, u1, v1] = rect;
  for (let i = 0; i < part.positions.length / 3; i++) {
    n.fromArray(part.normals, i * 3).applyMatrix3(nm).normalize();
    v.fromArray(part.positions, i * 3).applyMatrix4(m).addScaledVector(n, lift);
    const u = part.uvs[i * 2];
    const w = part.uvs[i * 2 + 1];
    mb.vert(v.x, v.y, v.z, n.x, n.y, n.z, u0 + (u1 - u0) * u, v1 - (v1 - v0) * w);
  }
  for (let i = 0; i < part.index.length; i += 3) mb.tri(base + part.index[i], base + part.index[i + 1], base + part.index[i + 2]);
}

const a = new Vector3();
const b = new Vector3();

/** vertex of the part's first quad whose uv is nearest (u, v) */
function cornerOf(part: SignPart, u: number, w: number): number {
  let best = part.index[0];
  let bestD = Infinity;
  for (let k = 0; k < Math.min(6, part.index.length); k++) {
    const i = part.index[k];
    const d = (part.uvs[i * 2] - u) ** 2 + (part.uvs[i * 2 + 1] - w) ** 2;
    if (d < bestD) [best, bestD] = [i, d];
  }
  return best;
}

/** bilinear point of the face at (u, v) (glTF uv, v = 0 top) in model space */
function facePoint(part: SignPart, c: readonly number[], u: number, w: number, out: Vector3): Vector3 {
  const P = part.positions;
  a.fromArray(P, c[0] * 3).lerp(b.fromArray(P, c[1] * 3), u);
  const top = a.clone();
  a.fromArray(P, c[3] * 3).lerp(b.fromArray(P, c[2] * 3), u);
  return out.copy(top).lerp(a, w);
}

/** a sub-rectangle of a single-quad sign face (layered lettering), `lift` metres off the face */
export function emitRegion(mb: MeshBuilder, part: SignPart, m: Matrix4, region: FaceRect, rect: UvRect, board: string, glow: number, lift: number): void {
  const c = [cornerOf(part, 0, 0), cornerOf(part, 1, 0), cornerOf(part, 1, 1), cornerOf(part, 0, 1)];
  nm.getNormalMatrix(m);
  n.fromArray(part.normals, c[0] * 3).applyMatrix3(nm).normalize();
  const [u0, vt, u1, vb] = region;
  const pt = (u: number, w: number): P3 => {
    facePoint(part, c, u, w, v).applyMatrix4(m).addScaledVector(n, lift);
    return [v.x, v.y, v.z];
  };
  mb.color(board).kind(glow);
  mb.quad(pt(u0, vb), pt(u1, vb), pt(u1, vt), pt(u0, vt), [n.x, n.y, n.z], rect);
}

/** a quad given in the model's local space (corners counter-clockwise from bottom-left as the reader sees it) */
export function emitLocalQuad(mb: MeshBuilder, m: Matrix4, corners: readonly [P3, P3, P3, P3], normal: P3, rect: UvRect, board: string, glow: number): void {
  nm.getNormalMatrix(m);
  const w = corners.map((c): P3 => {
    v.set(c[0], c[1], c[2]).applyMatrix4(m);
    return [v.x, v.y, v.z];
  });
  n.set(normal[0], normal[1], normal[2]).applyMatrix3(nm).normalize();
  mb.color(board).kind(glow);
  mb.quad(w[0], w[1], w[2], w[3], [n.x, n.y, n.z], rect);
}

/** double-sided vertical board sticking out of a facade at local x, spanning z0..z1 (toward the street) and y0..y1 */
export function emitBlade(mb: MeshBuilder, m: Matrix4, x: number, y0: number, y1: number, z0: number, z1: number, rect: UvRect, edge: UvRect, board: string, glow: number): void {
  const t = 0.05;
  emitLocalQuad(mb, m, [[x + t, y0, z1], [x + t, y0, z0], [x + t, y1, z0], [x + t, y1, z1]], [1, 0, 0], rect, board, glow);
  emitLocalQuad(mb, m, [[x - t, y0, z0], [x - t, y0, z1], [x - t, y1, z1], [x - t, y1, z0]], [-1, 0, 0], rect, board, glow);
  emitLocalQuad(mb, m, [[x - t, y0, z1], [x + t, y0, z1], [x + t, y1, z1], [x - t, y1, z1]], [0, 0, 1], edge, board, glow);
  emitLocalQuad(mb, m, [[x - t, y1, z0], [x + t, y1, z0], [x + t, y1, z1], [x - t, y1, z1]], [0, 1, 0], edge, board, glow);
  emitLocalQuad(mb, m, [[x - t, y0, z0], [x + t, y0, z0], [x + t, y0, z1], [x - t, y0, z1]], [0, -1, 0], edge, board, glow);
}

/** sandwich-board (A-frame) menu standing at local (x, z): readable from the street and from the shop */
export function emitAFrame(mb: MeshBuilder, m: Matrix4, x: number, z: number, rect: UvRect, glow: number): void {
  const hw = 0.3;
  const h = 0.9;
  const foot = 0.2;
  const lean: P3 = [0, 0.22, 0.97];
  emitLocalQuad(mb, m, [[x - hw, 0, z + foot], [x + hw, 0, z + foot], [x + hw, h, z], [x - hw, h, z]], lean, rect, '#ffffff', glow);
  emitLocalQuad(mb, m, [[x + hw, 0, z - foot], [x - hw, 0, z - foot], [x - hw, h, z], [x + hw, h, z]], [0, 0.22, -0.97], rect, '#ffffff', glow);
}
