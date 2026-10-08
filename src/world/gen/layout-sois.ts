import type { Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { LayoutTuning } from './district-types';
import { HALF, PARALLEL_GAP, type LayoutBuilder, type RegSeg } from './layout-builder';
import type { LineSpec } from './layout-types';
import { intersectRay, rayToBounds } from './seg-math';

interface GrowOpts {
  minLen: number;
  /** a crossing road within this distance of the wanted end is joined instead of stopping short */
  snap: number;
  allowExit: boolean;
}

const at = (p: Vec2, d: Vec2, t: number): Vec2 => ({ x: p.x + d.x * t, z: p.z + d.z * t });
const segLen = (s: RegSeg): number => Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
const segDir = (s: RegSeg): Vec2 => {
  const l = segLen(s);
  return { x: (s.b.x - s.a.x) / l, z: (s.b.z - s.a.z) / l };
};

/**
 * Grow a soi from p0 along d, aiming for `want` metres. Stops at the first major road, joins crossings near the
 * wanted end, keeps clear of reserved lots and parallel roads. Registers the segment; returns its length (0 = none).
 */
export function growSoi(L: LayoutBuilder, line: LineSpec, p0: Vec2, d: Vec2, want: number, o: GrowOpts): number {
  const tBound = rayToBounds(p0, d, HALF);
  const tRes = L.castReserve(p0, d, tBound, 12) - 2;
  const hits = L.cast(p0, d, Math.min(tBound, want + o.snap));
  let limit = Math.min(tBound, tRes);
  const major = hits.find((h) => h.seg.cls !== 'soi');
  if (major) limit = Math.min(limit, major.t);
  let end = Math.min(want, limit);
  const near = hits
    .filter((h) => h.t <= limit + 1e-6 && Math.abs(h.t - end) < o.snap)
    .sort((p, q) => Math.abs(p.t - end) - Math.abs(q.t - end))[0];
  if (near) end = near.t;
  else if (limit - end < o.snap && limit < Infinity) end = limit;
  if (Math.abs(end - tBound) < 1e-6 && !o.allowExit) end = tBound - 30;
  while (end >= o.minLen && L.parallelConflict(p0, at(p0, d, end), PARALLEL_GAP, line.id)) {
    const prev = hits.filter((h) => h.t < end - 1 && h.t >= o.minLen).pop();
    end = prev ? prev.t : end - 12;
  }
  if (end < o.minLen) return 0;
  const seg = L.addSeg(line.id, p0, at(p0, d, end));
  L.snapTipsTo(seg, 20);
  return end;
}

/** perpendicular of a canonical axis-aligned line, toward `side` */
const sideNormal = (horiz: boolean, side: number): Vec2 => (horiz ? { x: 0, z: side } : { x: side, z: 0 });
const rotate = (v: Vec2, a: number): Vec2 => ({
  x: v.x * Math.cos(a) - v.z * Math.sin(a),
  z: v.x * Math.sin(a) + v.z * Math.cos(a),
});

/**
 * Fishbone sois branching off one side of a major segment. `far` = distance to the next parallel major on that
 * side (through-soi target) or null. Returns the created soi lines in order along the parent.
 */
export function branchSois(
  L: LayoutBuilder, rng: Rng, T: LayoutTuning, parent: LineSpec, seg: RegSeg, side: number, far: number | null,
): LineSpec[] {
  const out: LineSpec[] = [];
  const dirP = segDir(seg);
  const len = segLen(seg);
  const nrm = sideNormal(seg.horiz, side);
  for (let s = rng.range(16, 42); s < len - 16; s += rng.range(T.soiStep[0], T.soiStep[1])) {
    const p0 = at(seg.a, dirP, s);
    const along = seg.horiz ? p0.x : p0.z;
    if (!L.mouthOK(parent.id, along, side)) continue;
    const d = rotate(nrm, rng.range(-0.045, 0.045));
    const toEdge = rayToBounds(p0, d, HALF);
    const avail = far ?? toEdge;
    let want: number;
    if (far !== null && rng.chance(T.through)) want = far + 4;
    else if (far === null && toEdge < T.deadEndMax + 60 && rng.chance(0.3)) want = toEdge;
    else want = rng.range(45, Math.max(46, Math.min(T.deadEndMax, avail - 32)));
    const line = L.addLine('soi', 'soi', parent.id, side, along);
    const got = growSoi(L, line, p0, d, want, { minLen: 42, snap: 22, allowExit: true });
    if (got <= 0) {
      L.lines.pop();
      continue;
    }
    L.addJunction(parent.id, along, side, false);
    out.push(line);
  }
  return out;
}

/** cross-sois joining neighbouring sois of the same side (creates loops for one-way sois and irregular blocks) */
export function linkSois(L: LayoutBuilder, rng: Rng, T: LayoutTuning, sois: readonly LineSpec[]): void {
  for (let i = 0; i + 1 < sois.length; i++) {
    if (!rng.chance(T.link)) continue;
    const [A, B] = [sois[i], sois[i + 1]];
    const sa = L.segsOf(A.id)[0];
    const sb = L.segsOf(B.id)[0];
    if (!sa || !sb) continue;
    const maxDepth = Math.min(segLen(sa), segLen(sb)) - 18;
    if (maxDepth < 40) continue;
    const depth = rng.range(40, maxDepth);
    const p0 = at(sa.a, segDir(sa), depth);
    const toward = sa.horiz ? { x: 0, z: Math.sign(sb.a.z - sa.a.z) } : { x: Math.sign(sb.a.x - sa.a.x), z: 0 };
    const want = intersectRay(p0, toward, sb, 0);
    if (want === null || want < 25 || !L.mouthOK(A.id, depth, 0)) continue;
    const line = L.addLine('soi', 'link', A.id, Math.sign(want), depth);
    if (growSoi(L, line, p0, toward, want, { minLen: 25, snap: 10, allowExit: false }) <= 0) {
      L.lines.pop();
      continue;
    }
    L.addJunction(A.id, depth, 0, false);
  }
}

/** short dead-end branches (soi yaek) off long sois */
export function yaekSois(L: LayoutBuilder, rng: Rng, T: LayoutTuning, sois: readonly LineSpec[]): void {
  for (const parent of sois) {
    const seg = L.segsOf(parent.id)[0];
    if (!seg || segLen(seg) < 85 || !rng.chance(T.yaek)) continue;
    const depth = rng.range(30, segLen(seg) - 25);
    const side = rng.chance(0.5) ? 1 : -1;
    if (!L.mouthOK(parent.id, depth, side)) continue;
    const dir = segDir(seg);
    const d = { x: -dir.z * side, z: dir.x * side };
    const line = L.addLine('soi', 'yaek', parent.id, side, depth);
    const got = growSoi(L, line, at(seg.a, dir, depth), d, rng.range(28, 55), { minLen: 24, snap: 14, allowExit: false });
    if (got <= 0) {
      L.lines.pop();
      continue;
    }
    L.addJunction(parent.id, depth, side, false);
  }
}
