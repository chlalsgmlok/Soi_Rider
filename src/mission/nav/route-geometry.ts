import type { CityData, Lane, Vec2 } from '../../core/types';
import type { LaneRoute } from './lane-search';

/** a lane change is drawn as an S-curve over this many metres at most */
export const CHANGE_RUN = 14;
const CHANGE_SAMPLES = 7;

const at = (l: Lane, s: number): Vec2 => {
  const t = Math.min(Math.max(0, s), l.length);
  return { x: l.start.x + l.dir.x * t, z: l.start.z + l.dir.z * t };
};

/**
 * Turns a lane route into the polyline the rider follows (lane centre lines, junction connector curves, smooth lane
 * changes) ending at `stop` — the curbside POI point — when it lies off the lane centre.
 */
export function routePoints(data: CityData, route: LaneRoute, stop: Vec2 | null): Vec2[] {
  const pts: Vec2[] = [];
  const add = (p: Vec2): void => {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.05) pts.push({ x: p.x, z: p.z });
  };
  const { steps, goal } = route;
  let lane = data.lanes[steps[0].lane];
  let s = steps[0].s;
  add(at(lane, s));
  for (let i = 1; i < steps.length; i++) {
    const st = steps[i];
    if (st.kind === 'connector') {
      add(lane.end);
      for (const p of data.connectors[st.connector].points) add(p);
      lane = data.lanes[st.lane];
      s = 0;
      add(lane.start);
      continue;
    }
    const next = data.lanes[st.lane];
    const limit = lastOnLaneGroup(route, i) ? Math.min(goal.s, next.length) : next.length;
    const s1 = Math.min(limit, s + Math.min(CHANGE_RUN, Math.max(0, limit - s) * 0.5));
    for (let k = 1; k <= CHANGE_SAMPLES; k++) {
      const t = k / CHANGE_SAMPLES;
      const e = t * t * (3 - 2 * t);
      const sa = s + (s1 - s) * t;
      const a = at(lane, sa);
      const b = at(next, sa);
      add({ x: a.x + (b.x - a.x) * e, z: a.z + (b.z - a.z) * e });
    }
    lane = next;
    s = s1;
  }
  const end = at(lane, goal.s);
  const curbside = stop !== null && Math.hypot(stop.x - end.x, stop.z - end.z) > 0.3;
  // drift over to the curbside stop point during the last few metres instead of a sideways kink
  if (lane.id === goal.lane && goal.s > s) add(curbside ? at(lane, Math.max(s, goal.s - 6)) : end);
  if (stop) add(stop);
  return pts;
}

/** true when no connector follows step i (the route ends in this carriageway) */
function lastOnLaneGroup(route: LaneRoute, i: number): boolean {
  for (let k = i + 1; k < route.steps.length; k++) if (route.steps[k].kind === 'connector') return false;
  return true;
}
