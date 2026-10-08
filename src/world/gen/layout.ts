import type { Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { DistrictDef } from './district-types';
import { LayoutBuilder } from './layout-builder';
import { buildMajors, type Majors } from './layout-majors';
import { placeReserves } from './layout-reserves';
import { branchSois, linkSois, yaekSois } from './layout-sois';
import type { Layout, LineSpec } from './layout-types';
import { trunkSoi } from './layout-trunks';
import { nameLines } from './naming';

/** the rider's home soi: an M1 soi close to (but not at) the main cross junction, like Soi 23 off Asok */
function pickSpawn(L: LayoutBuilder, M: Majors): number {
  const len = (l: LineSpec): number =>
    L.segsOf(l.id).reduce((s, g) => s + Math.hypot(g.b.x - g.a.x, g.b.z - g.a.z), 0);
  const sois = L.lines.filter((l) => l.role === 'soi' && len(l) >= 50);
  const onMain = sois.filter((l) => l.parent === M.m1.line.id);
  const pool = onMain.length > 0 ? onMain : sois;
  if (pool.length === 0) return -1;
  const score = (l: LineSpec): number => {
    const d = Math.abs(l.along - M.c1.pos);
    return l.parent !== M.m1.line.id ? 1000 + d : d < 30 ? 500 - d : d;
  };
  return pool.reduce((best, l) => (score(l) < score(best) ? l : best), pool[0]).id;
}

/** random dihedral symmetry of the square so the arterial can run along x or z, either way */
function transform(L: LayoutBuilder, spawnLine: number, t: number): Layout {
  const swap = (t & 4) !== 0;
  const fx = t & 1 ? -1 : 1;
  const fz = t & 2 ? -1 : 1;
  const map = (p: Vec2): Vec2 => ({ x: (swap ? p.z : p.x) * fx, z: (swap ? p.x : p.z) * fz });
  return {
    lines: L.lines,
    segs: L.segs.map((s) => ({ a: map(s.a), b: map(s.b), line: s.line })),
    reserves: L.reserves.map((r) => {
      const p = map({ x: r.rect.minX, z: r.rect.minZ });
      const q = map({ x: r.rect.maxX, z: r.rect.maxZ });
      return {
        key: r.key,
        line: r.line,
        facing: map(r.facing),
        rect: { minX: Math.min(p.x, q.x), maxX: Math.max(p.x, q.x), minZ: Math.min(p.z, q.z), maxZ: Math.max(p.z, q.z) },
      };
    }),
    spawnLine,
  };
}

/**
 * Bangkok-like road layout as line segments: arterial skeleton → landmark lots → back trunk sois → fishbone sois off every major
 * road (dead ends, through-sois, river-bound exits) → cross-links → soi yaek branches → names → random rotation.
 */
export function buildLayout(def: DistrictDef, rng: Rng): Layout {
  const L = new LayoutBuilder();
  const M = buildMajors(L, def, rng.fork('majors'));
  placeReserves(L, def, M, rng.fork('reserves'));
  const r = rng.fork('sois');
  const T = def.layout;
  const groups: LineSpec[][] = [];
  const pSide = M.p1 ? Math.sign(M.p1.pos - M.m1.pos) : 0;
  const trunkM1 = new Map<number, number | null>([1, -1].map((side) => [side, side === pSide ? null : trunkSoi(L, r, M, M.m1, side)]));
  const trunkP1 = M.p1 ? trunkSoi(L, r, M, M.p1, pSide) : null;
  for (const side of [1, -1]) {
    const far = M.p1 && side === pSide ? Math.abs(M.p1.pos - M.m1.pos) : trunkM1.get(side) ?? null;
    groups.push(branchSois(L, r, T, M.m1.line, M.m1.seg, side, far));
  }
  if (M.p1) groups.push(branchSois(L, r, T, M.p1.line, M.p1.seg, pSide, trunkP1));
  for (const c of [M.c1, M.c2]) {
    if (!c) continue;
    for (const side of [1, -1]) groups.push(branchSois(L, r, T, c.line, c.seg, side, null));
  }
  for (const g of groups) linkSois(L, r, T, g);
  yaekSois(L, r, T, groups.flat());
  const spawnLine = pickSpawn(L, M);
  nameLines(L.lines, def, spawnLine, rng.fork('names'));
  return transform(L, spawnLine, rng.fork('orient').int(0, 7));
}
