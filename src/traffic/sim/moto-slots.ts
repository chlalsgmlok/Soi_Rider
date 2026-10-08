import type { AheadHit } from './corridor';
import type { DriveCtx } from './drive-ctx';
import type { Vehicle } from './vehicle';

/** half width a motorbike needs for its slot (mirror span) */
export const MOTO_HALF = 0.42;
const SLOT_STEP = 0.4;
const SLOT_LOOK = 22;
/** keep this far from the centre line of a two-way road without median (oncoming traffic) */
const CENTRE_KEEP = 0.65;
const hit: AheadHit = { gap: Infinity, speed: 0, kind: 'none', index: -1 };
const cand: number[] = [];

/** lateral range (relative to the current track centre) a motorbike may use: whole carriageway on lanes */
export function slotRange(v: Vehicle, ctx: DriveCtx): [number, number] {
  const t = ctx.tracks.get(v.track);
  if (t.lane < 0) return [-0.7, 0.7];
  const lane = ctx.tracks.city.lanes[t.lane];
  const edge = ctx.tracks.city.edges[lane.edge];
  const n = ctx.tracks.siblings[t.lane].length;
  const w = lane.width;
  const keep = edge.median > 0 || edge.oneWay ? 0.45 : CENTRE_KEEP;
  return [-(lane.index + 0.5) * w + keep, (n - lane.index - 0.5) * w - 0.42];
}

/**
 * Pick the lateral slot with the longest free run ahead — filtering between cars at lane boundaries, the curb
 * gutter, or the middle of the lane — penalising big sideways moves and straying from the rider's habit.
 */
export function chooseSlot(v: Vehicle, self: number, ctx: DriveCtx): number {
  const [lo, hi] = slotRange(v, ctx);
  ctx.scanner.gather(v, self, SLOT_LOOK);
  const score = (lat: number): number => {
    ctx.scanner.nearest(lat, MOTO_HALF, hit);
    return Math.min(hit.gap, SLOT_LOOK) - 1.6 * Math.abs(lat - v.lat) - 0.35 * Math.abs(lat - v.jitter);
  };
  const cur = Math.min(hi, Math.max(lo, v.lat));
  let best = cur;
  let bestScore = score(cur) + 1;
  for (let lat = lo; lat <= hi + 1e-6; lat += SLOT_STEP) {
    if (Math.abs(lat - cur) < SLOT_STEP * 0.5) continue;
    const s = score(lat);
    if (s > bestScore) {
      bestScore = s;
      best = lat;
    }
  }
  return best;
}

/** riding past slow cars within arm's reach — keep it to filtering speed */
export function squeezing(v: Vehicle, self: number, ctx: DriveCtx): boolean {
  const n = ctx.obstacles.query(v.pos.x - 6, v.pos.z - 6, v.pos.x + 6, v.pos.z + 6, cand);
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  for (let k = 0; k < n; k++) {
    const o = ctx.obstacles.items[cand[k]];
    if (cand[k] === self || o.kind !== 'vehicle' || o.hw < 0.6 || o.speed > 2.5) continue;
    const rx = o.x - v.pos.x;
    const rz = o.z - v.pos.z;
    const along = rx * fx + rz * fz;
    const side = Math.abs(rx * fz - rz * fx);
    if (along > -o.hl && along < o.hl + 4 && side < o.hw + 1.1) return true;
  }
  return false;
}
