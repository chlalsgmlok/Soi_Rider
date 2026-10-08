import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { Surface } from '../../core/types';
import { buildSurfaceMap } from '../gen/surface-build';
import { generateCity } from '../gen/generate';
import { btsLine, trackPoint } from './bts/bts-line';
import { stripeCount } from './ground/curb-profile';
import { edgeSpans } from './ground/edge-spans';
import { medianRuns } from './ground/median-build';
import { placeSpeedBumps } from './ground/speed-bumps';
import { CityHeights } from './heights';
import { HEIGHTS } from './kit/dims';

const data = generateCity(7, 'sukhumvit');
const surface = buildSurfaceMap(data);

describe('city view layout (pure parts)', () => {
  it('puts speed humps across soi carriageways only, deterministic and clear of the spawn', () => {
    const a = placeSpeedBumps(data, new Rng(3).fork('bumps'));
    const b = placeSpeedBumps(data, new Rng(3).fork('bumps'));
    expect(a.length).toBeGreaterThan(3);
    expect(b).toEqual(a);
    for (const { bump, edge } of a) {
      expect(data.edges[edge].cls).toBe('soi');
      expect(surface.at(bump.obb.cx, bump.obb.cz)).toBe(Surface.Road);
      expect(Math.hypot(bump.obb.cx - data.spawn.pos.x, bump.obb.cz - data.spawn.pos.z)).toBeGreaterThan(10);
      expect(bump.height).toBeGreaterThan(0.03);
    }
  });

  it('runs curbs inside their verge and extends exit roads beyond the square', () => {
    const spans = edgeSpans(data.nodes, data.edges, data.bounds);
    expect(spans).toHaveLength(data.edges.length);
    for (const S of spans) {
      for (const sp of S.sides) {
        if (S.raised && sp.v1 - sp.v0 > 1) expect(sp.c1 - sp.c0).toBeGreaterThan(0);
        expect(sp.c0).toBeGreaterThanOrEqual(sp.v0 - 1e-6);
        expect(sp.c1).toBeLessThanOrEqual(sp.v1 + 1e-6);
      }
      if (S.exitA) expect(S.s0).toBeLessThan(-50);
      if (S.exitB) expect(S.s1).toBeGreaterThan(S.e.length + 50);
    }
  });

  it('reports ground heights matching the built surfaces', () => {
    const h = new CityHeights(data, surface);
    const lane = data.lanes[0];
    const mid = { x: (lane.start.x + lane.end.x) / 2, z: (lane.start.z + lane.end.z) / 2 };
    expect(h.ground(mid.x, mid.z)).toBeCloseTo(HEIGHTS.road, 2);
    let walk: { x: number; z: number } | null = null;
    for (let x = data.bounds.minX; x < data.bounds.maxX && !walk; x += 1.3) {
      for (let z = data.bounds.minZ; z < data.bounds.maxZ && !walk; z += 1.7) if (surface.at(x, z) === Surface.Sidewalk) walk = { x, z };
    }
    expect(walk).not.toBeNull();
    if (walk) expect(h.ground(walk.x, walk.z)).toBe(HEIGHTS.sidewalk);
    const shop = data.placements.find((p) => p.asset.startsWith('bld_shophouse'));
    if (shop) expect(h.placementY(shop)).toBe(HEIGHTS.building);
  });

  it('recovers the skytrain line with the station on it and tracks either side of the deck', () => {
    const line = btsLine(data.placements);
    expect(line).not.toBeNull();
    if (!line) return;
    expect(line.s1 - line.s0).toBeGreaterThan(400);
    expect(line.station).not.toBeNull();
    if (line.station !== null) {
      expect(line.station).toBeGreaterThan(line.s0);
      expect(line.station).toBeLessThan(line.s1);
    }
    const up = trackPoint(line, 0, 1);
    const down = trackPoint(line, 0, -1);
    expect(Math.hypot(up.x - down.x, up.z - down.z)).toBeCloseTo(4, 3);
  });

  it('recovers one median run per median collider and paints curbs with matching ends', () => {
    expect(medianRuns(data.colliders).length).toBe(data.colliders.filter((c) => c.tag === 'median').length);
    for (const L of [0.3, 1, 2, 7.6, 40]) expect(stripeCount(L) % 2).toBe(1);
  });
});
