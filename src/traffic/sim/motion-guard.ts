import type { OBB } from '../../core/types';
import type { DriveCtx } from './drive-ctx';
import { obbMayTouch, obbPenetration } from './obb-depth';
import type { Vehicle } from './vehicle';

/** numerical slack for "did not deepen" (m) */
const SLACK = 1e-4;
/** grazing contacts up to this depth never freeze anyone (a bike brushing a bumper while pulling away) */
const GRAZE = 0.02;
const other: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };
const cand: number[] = [];

/** Everything needed to undo one vehicle step. */
export interface StepUndo {
  track: number;
  prevTrack: number;
  s: number;
  lat: number;
  speed: number;
  grant: number;
  route: number[];
  obb: OBB;
  heading: number;
}

export function createUndo(): StepUndo {
  return { track: 0, prevTrack: -1, s: 0, lat: 0, speed: 0, grant: -1, route: [], obb: { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 }, heading: 0 };
}

export function remember(v: Vehicle, u: StepUndo): void {
  u.track = v.track;
  u.prevTrack = v.prevTrack;
  u.s = v.s;
  u.lat = v.lat;
  u.speed = v.speed;
  u.grant = v.grant;
  u.route.length = 0;
  for (const r of v.route) u.route.push(r);
  Object.assign(u.obb, v.obb);
  u.heading = v.heading;
}

/**
 * The last safety net under every NPC move: compare the hull after the step with the hull before against every
 * nearby body of this step's snapshot (vehicles and the rider). A step that pushes a contact deeper than a 2 cm graze
 * (or deeper than it already was) is undone and the vehicle stops — whatever the cause (a long bus swinging through
 * a turn, two decisions racing in one step).
 */
export function guardStep(v: Vehicle, self: number, u: StepUndo, ctx: DriveCtx): boolean {
  v.wedgedOn = -1;
  const a = v.obb;
  if (u.obb.cx === a.cx && u.obb.cz === a.cz && u.obb.angle === a.angle) return true;
  const r = Math.hypot(a.hw, a.hl) + 7;
  const n = ctx.obstacles.query(a.cx - r, a.cz - r, a.cx + r, a.cz + r, cand);
  for (let k = 0; k < n; k++) {
    const i = cand[k];
    if (i === self) continue;
    const o = ctx.obstacles.items[i];
    if (o.kind === 'pedestrian') continue;
    other.cx = o.x;
    other.cz = o.z;
    other.hw = o.hw;
    other.hl = o.hl;
    other.angle = o.h;
    if (!obbMayTouch(a, other)) continue;
    const after = obbPenetration(a, other);
    if (after <= 0) continue;
    if (after > Math.max(GRAZE, obbPenetration(u.obb, other)) + SLACK) {
      undo(v, u, ctx);
      v.wedgedOn = o.kind === 'player' ? -2 : o.ref;
      return false;
    }
  }
  return true;
}

function undo(v: Vehicle, u: StepUndo, ctx: DriveCtx): void {
  v.track = u.track;
  v.prevTrack = u.prevTrack;
  v.s = u.s;
  v.lat = u.lat;
  v.latVel = 0;
  v.speed = 0;
  v.accel = Math.min(0, v.accel);
  v.route.length = 0;
  for (const r of u.route) v.route.push(r);
  if (v.grant !== u.grant) {
    ctx.gate.release(v);
    if (u.grant >= 0) ctx.gate.force(v, u.grant);
  }
  // exactly the hull it had (a fresh place() would drop the steering yaw and could swing into a neighbour)
  v.laneId = ctx.tracks.isLane(v.track) ? v.track : -1;
  v.setPose(u.obb.cx, u.obb.cz, u.obb.angle, u.heading);
}
