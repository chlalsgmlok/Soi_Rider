import { describe, expect, it } from 'vitest';
import type { CityData } from '../../core/types';
import { city, TEST_DISTRICTS } from '../../world/gen/test-fixtures';
import { buildLaneGroups, carriageway } from './lane-groups';
import { LANE_CHANGE_PENALTY, type LanePoint, searchLanes } from './lane-search';
import { Navigator } from './navigator';
import { OFF_ROUTE_M, REROUTE_GAP } from './reroute-watch';
import { laneOffsetOf, startPoint } from './start-lane';

const CITIES: Array<[number, (typeof TEST_DISTRICTS)[number]]> = [[7, 'sukhumvit'], [2, 'yaowarat'], [42, 'silom'], [1, 'khaosan'], [7, 'siam']];

/** oracle: plain Dijkstra over the same moves (lane = entered at start, plus start-carriageway states) */
function dijkstra(data: CityData, start: LanePoint, goal: LanePoint): number {
  const groups = buildLaneGroups(data);
  const sg = carriageway(groups, start.lane);
  const n = data.lanes.length;
  const lane = (id: number): number => (id < n ? id : sg[id - n]);
  const sOf = (id: number): number => (id < n ? 0 : Math.min(start.s, data.lanes[lane(id)].length));
  const at = (id: number): [number, number] => {
    const l = data.lanes[lane(id)];
    return [l.start.x + l.dir.x * sOf(id), l.start.z + l.dir.z * sOf(id)];
  };
  const g = new Map<number, number>([[n + sg.indexOf(start.lane), 0]]);
  const done = new Set<number>();
  let best = Infinity;
  for (;;) {
    let id = -1;
    for (const [k, v] of g) if (!done.has(k) && (id < 0 || v < (g.get(id) ?? Infinity))) id = k;
    if (id < 0 || (g.get(id) ?? Infinity) >= best) return best;
    done.add(id);
    const cost = g.get(id) ?? Infinity;
    const l = data.lanes[lane(id)];
    if (l.id === goal.lane && sOf(id) <= goal.s) best = Math.min(best, cost + goal.s - sOf(id));
    const relax = (k: number, c: number): void => {
      if (!done.has(k) && c < (g.get(k) ?? Infinity)) g.set(k, c);
    };
    const grp = carriageway(groups, l.id);
    const i = grp.indexOf(l.id);
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= grp.length) continue;
      const k = id < n ? grp[j] : n + j;
      const [ax, az] = at(id);
      const [bx, bz] = at(k);
      relax(k, cost + Math.hypot(ax - bx, az - bz) + LANE_CHANGE_PENALTY);
    }
    for (const c of l.out) relax(data.connectors[c].to, cost + (l.length - sOf(id)) + data.connectors[c].length);
  }
}

describe('Navigator · A* over lanes + connectors', () => {
  it.each(CITIES)('finds a legal, plausible route from the spawn to every POI (seed %i, %s)', (seed, district) => {
    const data = city(seed, district);
    const nav = new Navigator(data);
    const groups = buildLaneGroups(data);
    const from = { pos: data.spawn.pos, heading: data.spawn.heading };
    const start = startPoint(data, from.pos, from.heading);
    expect(start).not.toBeNull();
    for (const poi of data.pois) {
      const path = nav.plan(from, poi);
      expect(path, `POI ${poi.id} ${poi.name}`).not.toBeNull();
      if (!path) continue;
      const straight = Math.hypot(poi.pos.x - from.pos.x, poi.pos.z - from.pos.z);
      expect(path.length).toBeGreaterThanOrEqual(straight - 1);
      expect(path.length).toBeLessThan(straight * 4 + 600);
      expect(Math.hypot(path.end.x - poi.pos.x, path.end.z - poi.pos.z)).toBeLessThan(0.01);
      // every move is legal: connectors chain lane → lane, lane changes stay in one carriageway, one-ways run a → b
      const found = searchLanes(data, groups, start as LanePoint, { lane: poi.lane, s: laneOffsetOf(data, poi.lane, poi.pos) });
      const steps = found?.steps ?? [];
      for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1];
        const st = steps[i];
        if (st.kind === 'connector') {
          expect(data.connectors[st.connector].from).toBe(prev.lane);
          expect(data.connectors[st.connector].to).toBe(st.lane);
        } else {
          expect(carriageway(groups, st.lane)).toContain(prev.lane);
          expect(Math.abs(data.lanes[st.lane].index - data.lanes[prev.lane].index)).toBe(1);
        }
        const edge = data.edges[data.lanes[st.lane].edge];
        if (edge.oneWay) expect(data.lanes[st.lane].forward).toBe(true);
      }
    }
  });

  it('matches a plain Dijkstra on the same graph (optimality)', () => {
    const data = city(7, 'sukhumvit');
    const groups = buildLaneGroups(data);
    const start = startPoint(data, data.spawn.pos, data.spawn.heading) as LanePoint;
    for (const poi of data.pois.slice(0, 12)) {
      const goal = { lane: poi.lane, s: laneOffsetOf(data, poi.lane, poi.pos) };
      const a = searchLanes(data, groups, start, goal);
      expect(a?.cost ?? Infinity).toBeCloseTo(dijkstra(data, start, goal), 6);
    }
  });

  it('loops around the block when the target lies behind on the same lane', () => {
    const data = city(7, 'sukhumvit');
    const groups = buildLaneGroups(data);
    const lane = data.lanes.find((l) => l.length > 40 && l.out.length > 0) ?? data.lanes[0];
    const r = searchLanes(data, groups, { lane: lane.id, s: 30 }, { lane: lane.id, s: 10 });
    expect(r).not.toBeNull();
    expect(r?.steps.some((st) => st.kind === 'connector')).toBe(true);
    expect(r?.cost ?? 0).toBeGreaterThan(lane.length);
  });

  it('starts on a lane running the rider\'s way when riding counterflow', () => {
    const data = city(7, 'sukhumvit');
    const lane = data.lanes.find((l) => {
      const e = data.edges[l.edge];
      return !e.oneWay && e.lanesAB > 0 && e.lanesBA > 0 && l.length > 30;
    }) ?? data.lanes[0];
    const pos = { x: lane.start.x + lane.dir.x * 15, z: lane.start.z + lane.dir.z * 15 };
    const against = Math.atan2(-lane.dir.x, -lane.dir.z);
    const st = startPoint(data, pos, against);
    const chosen = data.lanes[st?.lane ?? lane.id];
    expect(chosen.dir.x * -lane.dir.x + chosen.dir.z * -lane.dir.z).toBeGreaterThan(0.5);
  });
});

describe('Navigator · progress + re-route', () => {
  const data = city(7, 'sukhumvit');
  const spawn = { pos: data.spawn.pos, heading: data.spawn.heading, speed: 0 };
  const target = data.pois.reduce((a, b) => (Math.hypot(b.pos.x - spawn.pos.x, b.pos.z - spawn.pos.z) > 200 &&
    Math.hypot(a.pos.x - spawn.pos.x, a.pos.z - spawn.pos.z) <= 200 ? b : a));

  it('tracks remaining metres while following the route', () => {
    const nav = new Navigator(data);
    const path = nav.setTarget(target, spawn);
    expect(path).not.toBeNull();
    const total = nav.remaining;
    const p = path?.pointAt(40) ?? spawn.pos;
    const t = path?.tangentAt(40) ?? { x: 0, z: 1 };
    nav.update(1 / 60, { pos: p, heading: Math.atan2(t.x, t.z), speed: 5 });
    expect(nav.remaining).toBeCloseTo(total - 40, 0);
    expect(nav.offRoute).toBeLessThan(0.5);
    expect(nav.reroutes).toBe(0);
  });

  it(`re-routes when more than ${OFF_ROUTE_M} m off the route, throttled`, () => {
    const nav = new Navigator(data);
    const path = nav.setTarget(target, spawn);
    const t = path?.tangentAt(20) ?? { x: 0, z: 1 };
    const p = path?.pointAt(20) ?? spawn.pos;
    const off = { pos: { x: p.x - t.z * (OFF_ROUTE_M + 6), z: p.z + t.x * (OFF_ROUTE_M + 6) }, heading: Math.atan2(t.x, t.z), speed: 4 };
    const v0 = nav.version;
    nav.update(1 / 60, off);
    expect(nav.reroutes).toBe(1);
    expect(nav.version).toBeGreaterThan(v0);
    // a second excursion right away waits for the throttle
    const far = { ...off, pos: { x: off.pos.x + 400, z: off.pos.z + 400 } };
    nav.update(1 / 60, far);
    expect(nav.reroutes).toBe(1);
    for (let i = 0; i < Math.ceil(REROUTE_GAP * 60) + 2; i++) nav.update(1 / 60, far);
    expect(nav.reroutes).toBe(2);
  });

  it('re-routes after riding against the route for 2 s, not before', () => {
    const nav = new Navigator(data);
    const path = nav.setTarget(target, spawn);
    const t = path?.tangentAt(30) ?? { x: 0, z: 1 };
    const p = path?.pointAt(30) ?? spawn.pos;
    const back = { pos: p, heading: Math.atan2(-t.x, -t.z), speed: 4 };
    for (let i = 0; i < 100; i++) nav.update(1 / 60, back);
    expect(nav.reroutes).toBe(0);
    for (let i = 0; i < 30; i++) nav.update(1 / 60, back);
    expect(nav.reroutes).toBe(1);
  });
});
