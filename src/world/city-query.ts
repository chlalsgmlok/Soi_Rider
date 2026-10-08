import { Surface, type CityData, type CityQuery, type LaneHit, type StaticCollider, type SurfaceKind, type Vec2 } from '../core/types';
import { GridIndex } from './gen/grid-index';
import { buildingLine, halfWidth } from './gen/road-profile';
import { buildShadeMap } from './gen/shade-map';
import { buildSurfaceMap } from './gen/surface-build';
import { CeilingMap } from './ceiling-map';
import { DEFAULT_ROOF, RoofMap } from './roof-map';

/** default search radius of nearestLane (m) */
export const NEAREST_LANE_DEFAULT = 8;

function colliderBounds(c: StaticCollider): [number, number, number] {
  if (c.circle) return [c.circle.cx, c.circle.cz, c.circle.r];
  const o = c.obb;
  return o ? [o.cx, o.cz, Math.hypot(o.hw, o.hl)] : [0, 0, 0];
}

/**
 * Read-only spatial queries over a generated city. Uniform-grid indexes for lanes (8 m), road edges (16 m) and
 * static colliders (6 m); the surface and shade rasters answer point queries in O(1). Hot-path methods do not
 * allocate except for the returned LaneHit.
 */
export function createCityQuery(data: CityData): CityQuery {
  const { bounds, lanes, edges, nodes, colliders } = data;
  const surface = buildSurfaceMap(data);
  const shade = buildShadeMap(data);
  const roof = new RoofMap(bounds, data);
  const ceiling = new CeilingMap(data);

  const laneGrid = new GridIndex(bounds, 8, lanes.length);
  for (const l of lanes) {
    const pad = l.width;
    laneGrid.insert(l.id, Math.min(l.start.x, l.end.x) - pad, Math.min(l.start.z, l.end.z) - pad,
      Math.max(l.start.x, l.end.x) + pad, Math.max(l.start.z, l.end.z) + pad);
  }
  laneGrid.finalize();

  const edgeGrid = new GridIndex(bounds, 16, edges.length);
  for (const e of edges) {
    const a = nodes[e.a].pos;
    const b = nodes[e.b].pos;
    const pad = buildingLine(e) + 1;
    edgeGrid.insert(e.id, Math.min(a.x, b.x) - pad, Math.min(a.z, b.z) - pad, Math.max(a.x, b.x) + pad, Math.max(a.z, b.z) + pad);
  }
  edgeGrid.finalize();

  const colGrid = new GridIndex(bounds, 6, colliders.length);
  const cBounds = colliders.map(colliderBounds);
  colliders.forEach((c, i) => {
    const [x, z, r] = cBounds[i];
    colGrid.insert(c.id, x - r, z - r, x + r, z + r);
  });
  colGrid.finalize();

  return {
    data,
    surfaceAt: (x: number, z: number): SurfaceKind => surface.at(x, z),

    nearestLane(p: Vec2, maxDist = NEAREST_LANE_DEFAULT): LaneHit | null {
      const n = laneGrid.collect(p.x - maxDist, p.z - maxDist, p.x + maxDist, p.z + maxDist);
      let best = -1;
      let bestD = maxDist;
      let bestS = 0;
      for (let i = 0; i < n; i++) {
        const l = lanes[laneGrid.out[i]];
        const s = Math.min(l.length, Math.max(0, (p.x - l.start.x) * l.dir.x + (p.z - l.start.z) * l.dir.z));
        const d = Math.hypot(p.x - (l.start.x + l.dir.x * s), p.z - (l.start.z + l.dir.z * s));
        if (d < bestD || (d === bestD && best >= 0 && l.id < best)) {
          best = l.id;
          bestD = d;
          bestS = s;
        }
      }
      if (best < 0) return null;
      const lane = lanes[best];
      const lateral = (p.x - (lane.start.x + lane.dir.x * bestS)) * lane.dir.z - (p.z - (lane.start.z + lane.dir.z * bestS)) * lane.dir.x;
      return { lane, s: bestS, lateral, dist: bestD };
    },

    lane: (id) => lanes[id],
    connector: (id) => data.connectors[id],
    edge: (id) => edges[id],
    node: (id) => nodes[id],

    staticNear(p: Vec2, r: number, out: StaticCollider[]): number {
      out.length = 0;
      const n = colGrid.collect(p.x - r, p.z - r, p.x + r, p.z + r);
      for (let i = 0; i < n; i++) {
        const id = colGrid.out[i];
        const [x, z, cr] = cBounds[id];
        const rr = r + cr;
        if ((x - p.x) ** 2 + (z - p.z) ** 2 <= rr * rr) out.push(colliders[id]);
      }
      return out.length;
    },

    roadNameAt(p: Vec2): string {
      const n = edgeGrid.collect(p.x, p.z, p.x, p.z);
      let best = '';
      let bestScore = 1;
      for (let i = 0; i < n; i++) {
        const e = edges[edgeGrid.out[i]];
        const a = nodes[e.a].pos;
        const s = Math.min(e.length, Math.max(0, (p.x - a.x) * e.dir.x + (p.z - a.z) * e.dir.z));
        const d = Math.hypot(p.x - (a.x + e.dir.x * s), p.z - (a.z + e.dir.z * s));
        const score = d / buildingLine(e) - (d <= halfWidth(e) ? 1 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = e.name;
        }
      }
      return best;
    },

    shadedAt: (p: Vec2): boolean => shade.at(p.x, p.z) !== 0,

    roofAt(x: number, z: number): number {
      const h = roof.at(x, z);
      return h > 0 ? h : surface.at(x, z) === Surface.Building ? DEFAULT_ROOF : 0;
    },

    ceilingAt: (x: number, z: number): number => ceiling.at(x, z),
  };
}
