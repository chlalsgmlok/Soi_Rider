import { desiredSpeed, type DriveCtx } from './drive-ctx';
import { idmAccel } from './idm';
import { lateralBlocked } from './lateral-guard';
import { replan } from './route';
import type { Vehicle } from './vehicle';

/** MOBIL incentive threshold (m/s²) */
const THRESHOLD = 0.45;
const POLITENESS = 0.3;
/** a lane change takes this long (s) */
export const LANE_CHANGE_SEC = 2.6;
const near: Vehicle[] = [];

/** room for the rider to be beside the target slot (m along / across) */
function playerInTheWay(v: Vehicle, ctx: DriveCtx, latShift: number): boolean {
  if (ctx.playerIndex < 0) return false;
  const p = ctx.obstacles.items[ctx.playerIndex];
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  const rx = p.x - v.pos.x;
  const rz = p.z - v.pos.z;
  const along = rx * fx + rz * fz;
  const left = rx * fz - rz * fx;
  return Math.abs(along) < v.halfLen + 4 && Math.abs(left - latShift) < v.halfW + 1.4;
}

/** a motorbike on our own lane riding on the side we want to move into */
function motoOnSide(v: Vehicle, ctx: DriveCtx, dir: number): boolean {
  ctx.lists.within(v.track, v.s - v.halfLen - 3, v.s + v.halfLen + 4, v, near);
  for (const o of near) if (o.isMoto && (o.lat - v.lat) * dir > 0.3) return true;
  return false;
}

/**
 * MOBIL-lite discretionary lane change (cars only, every couple of seconds): move to a neighbouring lane of the
 * same carriageway when the IDM acceleration there beats the current one by a margin, the new follower does not
 * have to brake hard, both gaps are generous and no motorbike / rider is alongside. Slow vehicles drift to the
 * curb lane. Switches the track at once and lets the lateral offset slide over LANE_CHANGE_SEC with indicators.
 */
export function considerLaneChange(v: Vehicle, self: number, ctx: DriveCtx): void {
  v.lcCooldown -= ctx.dt;
  if (v.lcCooldown > 0 || v.laneChange > 0 || v.grant >= 0) return;
  v.lcCooldown = ctx.rng.range(1.6, 3.6);
  const t = ctx.tracks.get(v.track);
  if (t.lane < 0 || v.s < 6 || t.length - v.s < 32) return;
  const sib = ctx.tracks.siblings[t.lane];
  if (sib.length < 2) return;
  const lane = ctx.tracks.city.lanes[t.lane];
  const v0 = desiredSpeed(v, t, ctx);
  const slow = v.kind === 'bus' || v.kind === 'tuktuk' || v.kind === 'songthaew';
  let best = 0;
  let bestLane = -1;
  for (const dir of [-1, 1]) {
    const idx = lane.index + dir;
    const target = sib[idx];
    if (target === undefined) continue;
    const tl = ctx.tracks.get(target);
    if (Math.abs(tl.length - t.length) > 0.5) continue;
    const lead = ctx.lists.ahead(target, v.s - 0.01, null);
    const foll = ctx.lists.behind(target, v.s + 0.01, null);
    const gapL = lead ? lead.s - lead.halfLen - v.s - v.halfLen : Infinity;
    const gapF = foll ? v.s - v.halfLen - foll.s - foll.halfLen : Infinity;
    if (gapL < 2.5 + v.speed * 0.7) continue;
    if (foll && gapF < 3 + foll.speed * 1.1) continue;
    const aF = foll ? idmAccel(foll.speed, desiredSpeed(foll, tl, ctx), gapF, foll.speed - v.speed, foll.idm) : 0;
    if (aF < -2.4) continue;
    const latShift = dir * lane.width;
    if (motoOnSide(v, ctx, dir) || playerInTheWay(v, ctx, latShift)) continue;
    const pad = 1.5 + v.speed * 0.5;
    if (lateralBlocked(v, self, v.lat + latShift * 0.5, ctx, pad) || lateralBlocked(v, self, v.lat + latShift, ctx, pad)) continue;
    const aNew = idmAccel(v.speed, v0, gapL, lead ? v.speed - lead.speed : 0, v.idm);
    let gain = aNew - v.accel - POLITENESS * Math.max(0, -aF);
    if (slow) gain += dir * 0.35;
    if (gain > THRESHOLD && gain > best) {
      best = gain;
      bestLane = target;
    }
  }
  if (bestLane < 0) return;
  const dir = ctx.tracks.city.lanes[bestLane].index - lane.index;
  v.track = bestLane;
  v.prevTrack = -1;
  v.lat -= dir * lane.width;
  v.laneChange = LANE_CHANGE_SEC;
  v.lcDir = dir > 0 ? 1 : -1;
  v.indicator = dir > 0 ? -1 : 1;
  replan(v, ctx.tracks, ctx.rng, ctx.focus);
}
