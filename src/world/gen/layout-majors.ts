import type { Rng } from '../../core/rng';
import type { DistrictDef } from './district-types';
import { HALF, type LayoutBuilder, type RegSeg } from './layout-builder';
import type { LineSpec } from './layout-types';

/** An axis-aligned major road in the canonical frame (M1 runs along x). */
export interface MajorLine {
  line: LineSpec;
  seg: RegSeg;
  horiz: boolean;
  /** constant coordinate: z for horizontal lines, x for vertical ones */
  pos: number;
  /** extent along the line */
  from: number;
  to: number;
}

export interface Majors {
  m1: MajorLine;
  c1: MajorLine;
  p1: MajorLine | null;
  c2: MajorLine | null;
  all: MajorLine[];
}

function addMajor(L: LayoutBuilder, line: LineSpec, horiz: boolean, pos: number, from: number, to: number): MajorLine {
  const seg = horiz
    ? L.addSeg(line.id, { x: from, z: pos }, { x: to, z: pos })
    : L.addSeg(line.id, { x: pos, z: from }, { x: pos, z: to });
  return { line, seg, horiz, pos, from, to };
}

const covers = (m: MajorLine, v: number): boolean => v >= m.from - 1 && v <= m.to + 1;

/**
 * Lay out the arterial skeleton: the skytrain main road M1 (horizontal), a cross road C1 (main or avenue, full
 * or T), an optional parallel avenue P1 and an optional second cross avenue C2. Registers their junctions.
 */
export function buildMajors(L: LayoutBuilder, def: DistrictDef, rng: Rng): Majors {
  const T = def.layout;
  const vM = Math.round(rng.range(-55, 55));
  const m1 = addMajor(L, L.addLine('main', 'main', -1, 0, 0, true), true, vM, -HALF, HALF);

  const uC = Math.round(rng.range(-95, 95));
  const crossMain = rng.chance(T.crossMain);
  const tSide = rng.chance(T.crossT) ? (rng.chance(0.5) ? 1 : -1) : 0;
  const c1 = addMajor(
    L, L.addLine(crossMain ? 'main' : 'avenue', 'cross', -1, 0, uC), false, uC,
    tSide === 1 ? vM : -HALF, tSide === -1 ? vM : HALF,
  );
  let avenues = crossMain ? 0 : 1;

  let p1: MajorLine | null = null;
  if (rng.chance(T.parallel) || avenues === 0) {
    const roomPos = HALF - vM;
    const roomNeg = vM + HALF;
    let side = roomPos >= roomNeg ? 1 : -1;
    if (rng.chance(0.25) && Math.min(roomPos, roomNeg) > 190) side = -side;
    const room = side > 0 ? roomPos : roomNeg;
    const dist = Math.round(rng.range(130, Math.max(131, Math.min(185, room - 55))));
    p1 = addMajor(L, L.addLine('avenue', 'parallel', -1, side, dist), true, vM + side * dist, -HALF, HALF);
    avenues++;
  }

  let c2: MajorLine | null = null;
  if (avenues < 2 && rng.chance(T.cross2)) {
    for (let k = 0; k < 10 && !c2; k++) {
      const u = Math.round(rng.range(-200, 200));
      if (Math.abs(u - uC) < 150) continue;
      const mode = rng.int(0, 2);
      const away = p1 ? -Math.sign(p1.pos - vM) : rng.chance(0.5) ? 1 : -1;
      let from = -HALF;
      let to = HALF;
      if (mode === 0 && p1) [from, to] = [Math.min(vM, p1.pos), Math.max(vM, p1.pos)];
      else if (mode === 1) [from, to] = away > 0 ? [vM, HALF] : [-HALF, vM];
      c2 = addMajor(L, L.addLine('avenue', 'cross2', -1, 0, u), false, u, from, to);
    }
  }

  const all = [m1, c1, ...(p1 ? [p1] : []), ...(c2 ? [c2] : [])];
  for (const h of all.filter((m) => m.horiz)) {
    for (const v of all.filter((m) => !m.horiz)) {
      if (!covers(v, h.pos) || !covers(h, v.pos)) continue;
      L.addJunction(h.line.id, v.pos, 0, true);
      L.addJunction(v.line.id, h.pos, 0, true);
    }
  }
  return { m1, c1, p1, c2, all };
}
