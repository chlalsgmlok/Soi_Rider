import { KMH } from '../../core/math2d';
import { type Lane, type LaneHit, type StaticCollider, Surface, type SurfaceKind, type Vec2 } from '../../core/types';
import type { CollisionWorld } from '../../physics/collision-types';
import { ARENA_BLOCKS, ARENA_COLLIDERS, CROSSWALK, LANE_X, ROAD_HALF, SOI } from './arena-layout';

const LANE_LEN = 280;

function lane(id: number, x: number, forward: boolean, index: number): Lane {
  const z0 = forward ? -LANE_LEN / 2 : LANE_LEN / 2;
  return {
    id, edge: 0, forward, index, start: { x, z: z0 }, end: { x, z: -z0 }, dir: { x: 0, z: forward ? 1 : -1 },
    length: LANE_LEN, width: 3.5, offset: forward ? x : -x, speedLimit: 50 / KMH, out: [], in: [],
  };
}

/**
 * The arena's road for the physics and the camera: surface raster (road / crosswalk / junction / sidewalk /
 * building), four straight lanes (two each way, Thai left-hand traffic: +Z on x > 0) and the street furniture.
 * Implements the slice of CityQuery the player needs (CollisionWorld + nearestLane).
 */
export class ArenaWorld implements CollisionWorld {
  readonly lanes: Lane[] = [
    lane(0, LANE_X[0], true, 0), lane(1, LANE_X[1], true, 1), lane(2, -LANE_X[0], false, 0), lane(3, -LANE_X[1], false, 1),
  ];

  surfaceAt(x: number, z: number): SurfaceKind {
    const ax = Math.abs(x);
    if (ax <= ROAD_HALF) {
      if (z >= SOI.z0 && z <= SOI.z1) return Surface.Intersection;
      if (z >= CROSSWALK.z0 && z <= CROSSWALK.z1 && ax < ROAD_HALF - 0.6) return Surface.Crosswalk;
      return Surface.Road;
    }
    if (x > ROAD_HALF && z > SOI.z0 && z < SOI.z1 && x < 60) return Surface.Road;
    for (const [x0, x1, z0, z1] of ARENA_BLOCKS) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return Surface.Building;
    return Surface.Sidewalk;
  }

  staticNear(p: Vec2, r: number, out: StaticCollider[]): number {
    out.length = 0;
    for (const c of ARENA_COLLIDERS) {
      const cx = c.circle?.cx ?? c.obb?.cx ?? 0;
      const cz = c.circle?.cz ?? c.obb?.cz ?? 0;
      const cr = c.circle?.r ?? (c.obb ? Math.hypot(c.obb.hw, c.obb.hl) : 0);
      if ((cx - p.x) ** 2 + (cz - p.z) ** 2 <= (r + cr) ** 2) out.push(c);
    }
    return out.length;
  }

  nearestLane = (p: Vec2, maxDist = 8): LaneHit | null => {
    let best: LaneHit | null = null;
    for (const l of this.lanes) {
      const d = Math.abs(p.x - l.start.x);
      if (d > maxDist || (best && d >= best.dist)) continue;
      const s = Math.min(l.length, Math.max(0, (p.z - l.start.z) * l.dir.z));
      // + = left of the lane direction: left(+Z) = +X
      best = { lane: l, s, lateral: (p.x - l.start.x) * l.dir.z, dist: d };
    }
    return best;
  };
}
