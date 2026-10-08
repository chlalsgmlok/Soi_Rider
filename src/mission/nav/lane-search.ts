import type { CityData, Lane } from '../../core/types';
import type { LaneGroups } from './lane-groups';
import { MinHeap } from './min-heap';

/** a spot on a lane: `s` metres from its start */
export interface LanePoint {
  lane: number;
  s: number;
}

/** one move of a found route: the first lane ('start'), a lane change inside the carriageway, or a junction connector */
export interface RouteStep {
  kind: 'start' | 'change' | 'connector';
  lane: number;
  /** where the step enters `lane` (0 after a connector) */
  s: number;
  /** connector id for 'connector' steps, else −1 */
  connector: number;
}

export interface LaneRoute {
  steps: RouteStep[];
  /** metres (lane-change penalties included) */
  cost: number;
  goal: LanePoint;
}

/** metres a lane change costs on top of the sideways distance — routes keep their lane unless a turn needs it */
export const LANE_CHANGE_PENALTY = 4;

const dist = (l: Lane, s: number, x: number, z: number): number =>
  Math.hypot(l.start.x + l.dir.x * s - x, l.start.z + l.dir.z * s - z);

/**
 * A* over the legal lane graph (docs/GAME_DESIGN.md §9): lanes linked end → start by junction connectors (one-ways and
 * banned turns simply have no connector) plus lane changes between neighbours of one carriageway. Search state =
 * "lane entered at its start"; the carriageway of the start point gets extra states entered at the start offset.
 * Heuristic: straight-line distance from the state's entry point to the goal — admissible and consistent (every move
 * costs at least the distance it covers), so the first goal settled is optimal. Returns null when unreachable.
 */
export function searchLanes(data: CityData, groups: LaneGroups, start: LanePoint, goal: LanePoint): LaneRoute | null {
  const { lanes, connectors } = data;
  const n = lanes.length;
  const startGroup = groups.groups[groups.groupOf[start.lane]];
  const total = n + startGroup.length;
  const laneOf = (id: number): number => (id < n ? id : startGroup[id - n]);
  const sOf = (id: number): number => (id < n ? 0 : Math.min(Math.max(0, start.s), lanes[laneOf(id)].length));
  const gl = lanes[goal.lane];
  const gx = gl.start.x + gl.dir.x * goal.s;
  const gz = gl.start.z + gl.dir.z * goal.s;
  const h = (id: number): number => dist(lanes[laneOf(id)], sOf(id), gx, gz);

  const g = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const via = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const open = new MinHeap();
  const relax = (id: number, cost: number, from: number, conn: number): void => {
    if (closed[id] || cost >= g[id]) return;
    g[id] = cost;
    parent[id] = from;
    via[id] = conn;
    open.push(id, cost + h(id));
  };
  relax(n + startGroup.indexOf(start.lane), 0, -1, -1);

  let best = Infinity;
  let bestState = -1;
  while (open.size > 0) {
    const id = open.pop();
    if (closed[id]) continue;
    if (g[id] + h(id) >= best) break;
    closed[id] = 1;
    const lane = lanes[laneOf(id)];
    const s = sOf(id);
    if (lane.id === goal.lane && s <= goal.s + 1e-6) {
      const c = g[id] + (goal.s - s);
      if (c < best) {
        best = c;
        bestState = id;
      }
    }
    const grp = groups.groups[groups.groupOf[lane.id]];
    const i = grp.indexOf(lane.id);
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= grp.length) continue;
      const next = id < n ? grp[j] : n + j;
      const nl = lanes[laneOf(next)];
      const ns = sOf(next);
      const side = dist(lane, s, nl.start.x + nl.dir.x * ns, nl.start.z + nl.dir.z * ns);
      relax(next, g[id] + side + LANE_CHANGE_PENALTY, id, -1);
    }
    const rest = Math.max(0, lane.length - s);
    for (const cid of lane.out) relax(connectors[cid].to, g[id] + rest + connectors[cid].length, id, cid);
  }
  if (bestState < 0) return null;

  const chain: number[] = [];
  for (let id = bestState; id >= 0; id = parent[id]) chain.push(id);
  chain.reverse();
  const steps = chain.map((id, k): RouteStep => ({
    kind: k === 0 ? 'start' : via[id] >= 0 ? 'connector' : 'change',
    lane: laneOf(id),
    s: sOf(id),
    connector: via[id],
  }));
  return { steps, cost: best, goal: { ...goal } };
}
