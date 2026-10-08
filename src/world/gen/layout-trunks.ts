import type { Rng } from '../../core/rng';
import { HALF, type LayoutBuilder } from './layout-builder';
import type { MajorLine, Majors } from './layout-majors';
import { growSoi } from './layout-sois';

/** a trunk needs this much room between its major road and the map edge */
const MIN_ROOM = 125;

/**
 * Long "back soi" running parallel to a horizontal major road on a side with no other major road (like the
 * lanes that tie Sukhumvit's sois together behind the main road): grown from the cross road toward both map
 * edges at 85–150 m depth. Returns its depth from the major (the target for through-sois), or null.
 */
export function trunkSoi(L: LayoutBuilder, rng: Rng, M: Majors, base: MajorLine, side: number): number | null {
  const room = side > 0 ? HALF - base.pos : base.pos + HALF;
  if (room < MIN_ROOM) return null;
  const depth = Math.round(rng.range(85, Math.min(150, room - 35)));
  const at = base.pos + side * depth;
  const cross = [M.c1, M.c2].find((c) => c && !c.horiz && at >= c.from + 20 && at <= c.to - 20);
  if (!cross || !L.mouthOK(cross.line.id, at, 0, false)) return null;
  let grown = 0;
  for (const dir of [1, -1]) {
    const line = L.addLine('soi', 'soi', cross.line.id, dir, at);
    if (growSoi(L, line, { x: cross.pos, z: at }, { x: dir, z: 0 }, 2 * HALF, { minLen: 40, snap: 22, allowExit: true }) > 0) grown++;
    else L.lines.pop();
  }
  if (grown === 0) return null;
  L.addJunction(cross.line.id, at, 0, false);
  return depth;
}
