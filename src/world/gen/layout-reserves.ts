import type { Bounds2, Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { DistrictDef, LotSpec } from './district-types';
import { HALF, type LayoutBuilder } from './layout-builder';
import type { MajorLine, Majors } from './layout-majors';
import { classBuildingLine } from './road-profile';

interface Candidate {
  rect: Bounds2;
  line: number;
  facing: Vec2;
}

const blOf = (m: MajorLine): number => classBuildingLine(m.line.cls) + 0.5;

/** lot of frontage w and depth d along major m, starting at `start` along it, on `side` of it */
function along(m: MajorLine, start: number, w: number, d: number, side: number): Candidate {
  const n0 = m.pos + side * blOf(m);
  const n1 = n0 + side * d;
  const [a0, a1] = [Math.min(start, start + w), Math.max(start, start + w)];
  const [p0, p1] = [Math.min(n0, n1), Math.max(n0, n1)];
  const rect = m.horiz ? { minX: a0, maxX: a1, minZ: p0, maxZ: p1 } : { minX: p0, maxX: p1, minZ: a0, maxZ: a1 };
  return { rect, line: m.line.id, facing: m.horiz ? { x: 0, z: -side } : { x: -side, z: 0 } };
}

function overlapsCorridor(r: Bounds2, m: MajorLine): boolean {
  const half = blOf(m) - 0.25;
  const c = m.horiz
    ? { minX: m.from, maxX: m.to, minZ: m.pos - half, maxZ: m.pos + half }
    : { minX: m.pos - half, maxX: m.pos + half, minZ: m.from, maxZ: m.to };
  return r.minX < c.maxX && r.maxX > c.minX && r.minZ < c.maxZ && r.maxZ > c.minZ;
}

function valid(L: LayoutBuilder, M: Majors, c: Candidate): boolean {
  const r = c.rect;
  const lim = HALF - 6;
  if (r.minX < -lim || r.maxX > lim || r.minZ < -lim || r.maxZ > lim) return false;
  if (L.reserveClash(r, 10)) return false;
  return !M.all.some((m) => overlapsCorridor(r, m));
}

function* candidates(lot: LotSpec, M: Majors, rng: Rng): Generator<Candidate> {
  const { m1, c1 } = M;
  if (lot.at === 'corner') {
    const quads = rng.shuffle([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    for (const [su, sv] of quads) {
      if (c1.from > m1.pos + sv * 20 || c1.to < m1.pos + sv * 20) continue;
      const u0 = c1.pos + su * blOf(c1);
      yield along(m1, su > 0 ? u0 : u0 - lot.w, lot.w, lot.d, sv);
    }
  }
  const order: MajorLine[] =
    lot.at === 'cross' ? [c1, m1] : lot.at === 'avenue' ? [M.p1 ?? M.c2 ?? c1, m1] : [m1, c1];
  for (const m of order) {
    for (let k = 0; k < 16; k++) {
      const start = rng.range(m.from + 8, m.to - 8 - lot.w);
      yield along(m, start, lot.w, lot.d, rng.chance(0.5) ? 1 : -1);
    }
  }
}

/** reserve landmark lots (parks, temples, malls, shrines) next to major roads before sois are grown */
export function placeReserves(L: LayoutBuilder, def: DistrictDef, M: Majors, rng: Rng): void {
  for (const lot of def.lots) {
    for (const c of candidates(lot, M, rng)) {
      if (!valid(L, M, c)) continue;
      L.reserves.push({ key: lot.key, rect: c.rect, line: c.line, facing: c.facing });
      break;
    }
  }
}
