import { describe, expect, it } from 'vitest';
import { makeOBB } from '../../core/math2d';
import { type CityQuery, type Lane, type LaneHit, Surface, type TrafficAgentView, type TrafficQuery, type Vec2 } from '../../core/types';
import { FallRecovery } from './fall-recovery';

/** a straight 100 m road along +Z (|x| < 3 m), pavements beside it */
const lane = { id: 1, start: { x: 0, z: 0 }, end: { x: 0, z: 100 }, dir: { x: 0, z: 1 }, length: 100 } as Lane;
const city = {
  surfaceAt: (x: number) => (Math.abs(x) < 3 ? Surface.Road : Surface.Sidewalk),
  nearestLane: (p: Vec2): LaneHit | null => ({ lane, s: Math.min(100, Math.max(0, p.z)), lateral: -p.x, dist: Math.abs(p.x) }),
} as unknown as CityQuery;

/** parked cars as traffic (only their hulls matter) */
function traffic(cars: Vec2[]): TrafficQuery {
  const agents = cars.map((c, i) => ({ id: i, obb: makeOBB(c.x, c.z, 1.8, 4.4, 0) }) as unknown as TrafficAgentView);
  return {
    agents: () => agents,
    near(p, r, out) {
      out.length = 0;
      for (const a of agents) if (Math.hypot(a.obb.cx - p.x, a.obb.cz - p.z) <= r) out.push(a);
      return out.length;
    },
    pedestrians: () => [],
    signal: () => null,
    nudge: () => undefined,
  };
}

describe('FallRecovery', () => {
  it('lets the rider get up where they fell when the road there is free', () => {
    expect(new FallRecovery(city, traffic([])).find({ x: 1, z: 40 })).toBeNull();
  });

  it('moves a rider who landed on the pavement back onto the nearest lane, facing along it', () => {
    const spot = new FallRecovery(city, traffic([])).find({ x: 5, z: 40 });
    expect(spot).not.toBeNull();
    expect(spot?.pos.x).toBeCloseTo(0);
    expect(spot?.pos.z).toBeCloseTo(40);
    expect(spot?.heading).toBeCloseTo(0);
  });

  it('walks along the lane to a gap when a car sits on the fall spot', () => {
    const spot = new FallRecovery(city, traffic([{ x: 0, z: 40 }])).find({ x: 0.3, z: 40 });
    expect(spot).not.toBeNull();
    const p = spot?.pos ?? { x: 0, z: 0 };
    expect(Math.abs(p.z - 40)).toBeGreaterThanOrEqual(3);
    expect(Math.abs(p.z - 40)).toBeLessThanOrEqual(12);
    // the new spot clears the car's hull (2.2 m half length + the rider's room)
    expect(Math.abs(p.z - 40)).toBeGreaterThan(2.2 + 1.1);
  });

  it('keeps the rider in place when nothing better is in reach', () => {
    const jam = traffic([0, 3, 6, 9, 12].flatMap((d) => [{ x: 0, z: 40 + d }, { x: 0, z: 40 - d }]));
    expect(new FallRecovery(city, jam).find({ x: 0, z: 40 })).toBeNull();
  });
});
