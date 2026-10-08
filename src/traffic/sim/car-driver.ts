import { clamp } from '../../core/math2d';
import { advance, laneJitter } from './advance';
import type { DriveCtx } from './drive-ctx';
import { reactionHold, updateMood } from './driver-mood';
import { armIdle, idleTick } from './idle';
import { considerLaneChange, LANE_CHANGE_SEC } from './lane-change';
import { lateralBlocked } from './lateral-guard';
import { type LongPlan, planLongitudinal } from './longitudinal';
import { createUndo, guardStep, remember } from './motion-guard';
import { extendRoute } from './route';
import type { Track } from './tracks';
import type { Vehicle } from './vehicle';

/**
 * Cars stop behind the car stop line: at signals src/world paints the motorbike box (BIKE_BOX_DEPTH = 3.2 m) in front
 * of it, its 0.4 m stripe ends 3.6 m before the lane end; elsewhere they pull up to the lane end.
 */
export const CAR_STOP_BACK_SIGNAL = 3.75;
export const CAR_STOP_BACK = 0.45;
/** turn indicators come on this far before the junction (m) */
const SIGNAL_TURN_AT = 32;
/** lateral speed while drifting to the lane habit / during a lane change (m/s) */
const DRIFT_RATE = 0.3;
const CHANGE_RATE = 1.3;

const plan: LongPlan = { accel: 0, room: 0, lamp: 'green', distLine: Infinity, atGate: false };
const undo = createUndo();

function turnIndicator(t: Track, v: Vehicle, ctx: DriveCtx): -1 | 0 | 1 {
  const turn = t.lane < 0 ? t.turn : v.route[0] !== undefined && t.length - v.s < SIGNAL_TURN_AT ? ctx.tracks.get(v.route[0]).turn : null;
  if (turn === 'left') return -1;
  if (turn === 'right' || turn === 'uturn') return 1;
  return 0;
}

/**
 * One fixed step of a four-wheeled NPC: plan the route, maybe change lanes, keep its habitual offset inside the
 * lane (±0.3 m — gaps between lanes differ car to car), follow / stop / queue via the IDM and the junction gate,
 * then integrate and refresh pose, lights and horn.
 */
export function driveCar(v: Vehicle, self: number, ctx: DriveCtx): void {
  if (idleTick(v, ctx)) return;
  const dt = ctx.dt;
  v.age += dt;
  extendRoute(v, ctx.tracks, ctx.rng, ctx.focus);
  remember(v, undo);
  considerLaneChange(v, self, ctx);
  let t = ctx.tracks.get(v.track);
  v.latTarget = t.lane >= 0 ? laneJitter(v, t.width) : laneJitter(v, t.width) * 0.5;
  const rate = v.laneChange > 0 ? CHANGE_RATE : DRIFT_RATE;
  const step = clamp(v.latTarget - v.lat, -rate * dt, rate * dt);
  if (Math.abs(step) > 1e-6 && !lateralBlocked(v, self, v.lat + step, ctx)) {
    v.lat += step;
    v.latVel = step / dt;
  } else v.latVel = 0;
  if (v.laneChange > 0) {
    v.laneChange -= dt;
    if (v.laneChange < LANE_CHANGE_SEC - 0.8 && Math.abs(v.lat - v.latTarget) < 0.05) v.laneChange = 0;
  }
  const stopBack = t.lane >= 0 && ctx.tracks.city.nodes[t.node].signal ? CAR_STOP_BACK_SIGNAL : CAR_STOP_BACK;
  planLongitudinal(v, self, ctx, v.lat, v.halfW, stopBack, plan);
  advance(v, reactionHold(v, plan.accel, dt), plan.room, ctx);
  updateMood(v, plan, ctx);
  t = ctx.tracks.get(v.track);
  v.indicator = v.laneChange > 0 ? (v.lcDir > 0 ? -1 : 1) : turnIndicator(t, v, ctx);
  v.place(ctx.tracks);
  guardStep(v, self, undo, ctx);
  armIdle(v, plan.accel > 0);
}
