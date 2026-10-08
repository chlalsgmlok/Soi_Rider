/**
 * Ready-made MapSource over CityData road edges, for hud.setMapSource(mapSourceFromCity(city.data)).
 * Width = all lanes + median (sidewalks excluded so the map reads as streets).
 */
import type { CityData } from '../../core/types/world';
import type { Vec2 } from '../../core/types/geometry';
import type { MapRoad, MapSource } from './types';

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const l2 = abx * abx + abz * abz;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2)) : 0;
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

export function mapSourceFromCity(data: CityData): MapSource {
  const nodes = new Map(data.nodes.map((n) => [n.id, n]));
  const roads: MapRoad[] = [];
  for (const e of data.edges) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;
    roads.push({ a: a.pos, b: b.pos, width: (e.lanesAB + e.lanesBA) * e.laneWidth + e.median, cls: e.cls });
  }
  return (center, radius) => roads.filter((r) => segDist(center, r.a, r.b) <= radius + r.width);
}
