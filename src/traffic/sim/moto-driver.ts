import { clamp, damp } from '../../core/math2d';
import { advance } from './advance';
import type { DriveCtx } from './drive-ctx';
import { reactionHold, updateMood } from './driver-mood';
import { armIdle, idleTick } from './idle';
import { type LongPlan, planLongitudinal } from './longitudinal';
import { createUndo, guardStep, remember } from './motion-guard';
import { lateralBlocked } from './lateral-guard';
import { chooseSlot, MOTO_HALF, slotRange, squeezing } from './moto-slots';
import { extendRoute, replan } from './route';
import type { Vehicle } from './vehicle';

/** motorbikes roll right up to the bike stop line at the lane end — into the motorbike box in front of the cars */
const MOTO_STOP_BACK = 0.3;
/** top speed while threading between slow cars (m/s) */
const FILTER_SPEED = 5;
const plan: LongPlan = { accel: 0, room: 0, lamp: 'green', distLine: Infinity, atGate: false };
const undo = createUndo();

/** move to the neighbouring lane's track once the bike rides mostly in it (keeps routing and gates honest) */
function reanchor(v: Vehicle, ctx: DriveCtx): void {
  const t = ctx.tracks.get(v.track);
  if (t.lane < 0 || v.grant >= 0 || t.length - v.s < 1.5) return;
  const lane = ctx.tracks.city.lanes[t.lane];
  const half = lane.width / 2 + 0.25;
  const dir = v.lat > half ? 1 : v.lat < -half ? -1 : 0;
  const target = dir !== 0 ? ctx.tracks.siblings[t.lane][lane.index + dir] : undefined;
  if (target === undefined || Math.abs(ctx.tracks.get(target).length - t.length) > 0.5) return;
  v.track = target;
  v.prevTrack = -1;
  v.lat -= dir * lane.width;
  v.latTarget -= dir * lane.width;
  replan(v, ctx.tracks, ctx.rng, ctx.focus);
}

/**
 * Wedged against a body for a while (the motion guard keeps stopping it): sidestep away from it — a bike can
 * always shuffle sideways, which frees whoever it was blocking.
 */
function escapeWedge(v: Vehicle, ctx: DriveCtx): void {
  v.wedgeTime += ctx.dt;
  if (v.wedgeTime < 1.2 || v.slotTimer > 0.5) return;
  const o = v.wedgedOn === -2 ? ctx.obstacles.items[ctx.playerIndex] : ctx.obstacles.items[v.wedgedOn];
  if (!o) return;
  const left = (o.x - v.pos.x) * Math.cos(v.heading) - (o.z - v.pos.z) * Math.sin(v.heading);
  v.latTarget = v.lat + (left > 0 ? -0.9 : 0.9);
  v.slotTimer = 1.6;
  v.wedgeTime = 0;
}

/**
 * One fixed step of an NPC motorbike — a semi-free agent: it follows the lane graph for routing and junction
 * admission but chooses its own lateral slot (lane boundaries between cars, the curb gutter, mid-lane), filters to
 * the stop line at reds, weaves around slow traffic and never slides sideways into anything (lateral moves are
 * swept against nearby hulls first).
 */
export function driveMoto(v: Vehicle, self: number, ctx: DriveCtx): void {
  if (idleTick(v, ctx)) return;
  const dt = ctx.dt;
  v.age += dt;
  extendRoute(v, ctx.tracks, ctx.rng, ctx.focus);
  remember(v, undo);
  v.slotTimer -= dt;
  if (v.wedgedOn !== -1) escapeWedge(v, ctx);
  else v.wedgeTime = 0;
  if (v.slotTimer <= 0) {
    v.slotTimer = v.speed < 1 ? ctx.rng.range(0.5, 0.9) : ctx.rng.range(0.3, 0.6);
    v.latTarget = chooseSlot(v, self, ctx);
  }
  const [lo, hi] = slotRange(v, ctx);
  v.latTarget = clamp(v.latTarget, lo, hi);
  const rate = Math.min(1.25, 0.4 + 0.12 * v.speed);
  const want = clamp(v.latTarget - v.lat, -rate * dt, rate * dt) + v.nudgeVel * dt;
  v.nudgeVel *= 1 - damp(4, dt);
  if (Math.abs(want) > 1e-5 && !lateralBlocked(v, self, v.lat + want, ctx)) {
    v.lat += want;
    v.latVel = want / dt;
  } else {
    v.latVel = 0;
    if (Math.abs(want) > 1e-5) v.slotTimer = Math.min(v.slotTimer, 0.25);
  }
  reanchor(v, ctx);
  planLongitudinal(v, self, ctx, v.lat, MOTO_HALF, MOTO_STOP_BACK, plan);
  let a = plan.accel;
  if (v.speed > FILTER_SPEED * 0.8 && squeezing(v, self, ctx)) a = Math.min(a, (FILTER_SPEED - v.speed) * 1.5);
  advance(v, reactionHold(v, a, dt), plan.room, ctx);
  updateMood(v, plan, ctx);
  v.indicator = 0;
  v.place(ctx.tracks);
  guardStep(v, self, undo, ctx);
  armIdle(v, plan.accel > 0);
}
