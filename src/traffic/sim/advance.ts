import { clamp } from '../../core/math2d';
import type { DriveCtx } from './drive-ctx';
import { extendRoute } from './route';
import type { Vehicle } from './vehicle';

/**
 * Integrate one fixed step along the route: ballistic speed update, then the kinematic cap (never travel further
 * than `room`), then hop onto the next tracks when the centre passes a track end.
 */
export function advance(v: Vehicle, accel: number, room: number, ctx: DriveCtx): void {
  const dt = ctx.dt;
  let vn = Math.max(0, v.speed + accel * dt);
  // IDM approaches standstill asymptotically: call it stopped below walking-a-bike pace unless pulling away
  if (vn < 0.05 && accel < 0.15) vn = 0;
  let ds = (v.speed + vn) * 0.5 * dt;
  if (ds > room) {
    ds = Math.max(0, room);
    vn = room < 0.005 ? 0 : Math.min(vn, ds / dt);
  }
  v.accel = accel;
  v.speed = vn;
  v.s += ds;
  let t = ctx.tracks.get(v.track);
  while (v.s > t.length) {
    const next = v.route.shift();
    if (next === undefined) {
      v.s = t.length;
      v.speed = 0;
      return;
    }
    if (t.lane >= 0 && v.grant !== next) ctx.gate.force(v, next);
    v.s -= t.length;
    v.prevTrack = v.track;
    v.track = next;
    t = ctx.tracks.get(next);
    extendRoute(v, ctx.tracks, ctx.rng, ctx.focus);
  }
}

/** a car's preferred offset inside a lane of `width` (its habit, clamped so the body stays in the lane) */
export function laneJitter(v: Vehicle, width: number): number {
  const room = Math.max(0, (width - 2 * v.halfW) / 2 - 0.15);
  return clamp(v.jitter, -room, room);
}
