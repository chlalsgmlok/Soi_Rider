import type { StaticCollider } from '../../core/types';
import type { PedCtx } from './ped-ctx';
import type { Pedestrian } from './pedestrian';
import { stripPoint } from './sidewalk-net';

const LOOK = 2.2;
const statics: StaticCollider[] = [];
const cand: number[] = [];
/** blocked lateral intervals [lo, hi] in strip offsets (reused) */
const lo: number[] = [];
const hi: number[] = [];

/**
 * Choose the walking offset inside the strip for the next ~0.4 s: keep to the personal habit, step around poles,
 * trees, carts and stools a couple of metres ahead, keep LEFT of oncoming walkers. When a narrow soi apron is
 * fully blocked the walker steps off the kerb onto the road edge (very Bangkok).
 */
export function chooseOffset(p: Pedestrian, ctx: PedCtx): number {
  const st = ctx.net.strips[p.strip];
  const half = st.width / 2;
  const minOff = -half - 0.45;
  const maxOff = half - 0.28;
  lo.length = hi.length = 0;
  const ahead = p.s + p.dir * LOOK * 0.6;
  const c = stripPoint(st, ahead, 0);
  const n = ctx.city.staticNear(c, LOOK, statics);
  const e = st.frame.e;
  // strip frame: along = e.dir, outward = side·left(e.dir)
  const ox = st.frame.side * e.dir.z;
  const oz = -st.frame.side * e.dir.x;
  for (let k = 0; k < n; k++) {
    const sc = statics[k];
    if (sc.tag === 'building' || sc.tag === 'median') continue;
    const cx = sc.circle ? sc.circle.cx : (sc.obb?.cx ?? 0);
    const cz = sc.circle ? sc.circle.cz : (sc.obb?.cz ?? 0);
    const r = sc.circle ? sc.circle.r : Math.max(sc.obb?.hw ?? 0, sc.obb?.hl ?? 0);
    const along = (cx - c.x) * e.dir.x + (cz - c.z) * e.dir.z;
    if (Math.abs(along) > LOOK * 0.6 + r) continue;
    const out = (cx - c.x) * ox + (cz - c.z) * oz;
    lo.push(out - r - p.radius - 0.08);
    hi.push(out + r + p.radius + 0.08);
  }
  const m = ctx.obstacles.query(c.x - 3, c.z - 3, c.x + 3, c.z + 3, cand);
  for (let k = 0; k < m; k++) {
    const o = ctx.obstacles.items[cand[k]];
    if (o.kind !== 'pedestrian') continue;
    const other = ctx.peds[o.ref];
    if (!other || other === p || other.strip !== p.strip || other.mode !== 'walk') continue;
    const gap = (other.s - p.s) * p.dir;
    if (gap < 0 || gap > 3) continue;
    if (other.dir !== p.dir) {
      // oncoming: keep left of our own walking direction → outward when dir·side > 0
      const leftIsOut = p.dir * st.frame.side > 0;
      lo.push(leftIsOut ? -9 : other.off - 0.55);
      hi.push(leftIsOut ? other.off + 0.55 : 9);
    } else if (other.speed < p.cruise - 0.2) {
      lo.push(other.off - 0.6);
      hi.push(other.off + 0.6);
    }
  }
  const free = (x: number): boolean => {
    for (let i = 0; i < lo.length; i++) if (x > lo[i] && x < hi[i]) return false;
    return true;
  };
  const want = Math.max(minOff + 0.45, Math.min(maxOff, p.habit));
  if (free(want)) return want;
  let best = p.off;
  let bestCost = Infinity;
  for (let x = minOff; x <= maxOff; x += 0.15) {
    if (!free(x)) continue;
    const cost = Math.abs(x - want) + (x < -half ? 0.8 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = x;
    }
  }
  return best;
}
