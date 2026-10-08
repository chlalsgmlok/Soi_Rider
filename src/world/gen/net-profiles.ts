import type { Rng } from '../../core/rng';
import type { LayoutTuning } from './district-types';
import type { RoadNet } from './net-types';
import { ROAD_PROFILE, SPAWN_SOI_SIDEWALK } from './road-profile';

const SOI_LANE_WIDTHS = [3.0, 3.1, 3.2, 3.3, 3.4] as const;
/** shortest main-road block that can still take a median U-turn gap in its middle */
const MIN_OPENING_BLOCK = 36;

/**
 * Per-line cross-sections: majors use the class profile; each soi line picks a lane width (6.0–6.8 m roads) and
 * whether it has raised sidewalks. The rider's home soi always gets a wide sidewalk for the win stand.
 */
export function applyProfiles(net: RoadNet, T: LayoutTuning, spawnLine: number, rng: Rng): void {
  const perLine = new Map<number, { laneWidth: number; sidewalk: number }>();
  for (const line of net.lines) {
    if (line.cls !== 'soi') continue;
    const laneWidth = rng.pick(SOI_LANE_WIDTHS);
    const bare = rng.chance(Math.min(0.9, T.noSidewalk + (line.role === 'soi' ? 0 : 0.15)));
    const sidewalk = line.id === spawnLine ? SPAWN_SOI_SIDEWALK : bare ? 0 : ROAD_PROFILE.soi.sidewalk;
    perLine.set(line.id, { laneWidth, sidewalk });
  }
  net.edges.forEach((e, i) => {
    const p = perLine.get(net.edgeLine[i]);
    if (!p) return;
    e.laneWidth = p.laneWidth;
    e.sidewalk = p.sidewalk;
  });
}

/** split edge `id` at distance s from its a-end; returns the new node id */
export function splitEdge(net: RoadNet, id: number, s: number): number {
  const e = net.edges[id];
  const oldB = e.b;
  const m = net.nodes.length;
  net.nodes.push({ id: m, pos: { x: net.nodes[e.a].pos.x + e.dir.x * s, z: net.nodes[e.a].pos.z + e.dir.z * s }, edges: [], signal: false, radius: 0 });
  const id2 = net.edges.length;
  net.edges.push({ ...e, id: id2, a: m, b: oldB, length: e.length - s, dir: { ...e.dir } });
  net.edgeLine.push(net.edgeLine[id]);
  e.b = m;
  e.length = s;
  const nb = net.nodes[oldB];
  nb.edges = nb.edges.map((x) => (x === id ? id2 : x));
  net.nodes[m].edges.push(id, id2);
  return m;
}

/**
 * Median U-turn openings on long main-road blocks (the classic Bangkok "glap rot" gap). Each main line gets at
 * least one so traffic can reverse without a signalised junction.
 */
export function insertOpenings(net: RoadNet, chance: number, rng: Rng): void {
  const mainLines = new Set(net.edges.filter((e) => e.cls === 'main').map((e) => net.edgeLine[e.id]));
  for (const line of mainLines) {
    const candidates = net.edges.filter((e) => net.edgeLine[e.id] === line && e.length >= 84);
    let placed = 0;
    for (const e of candidates) {
      if (!rng.chance(chance)) continue;
      net.openings.add(splitEdge(net, e.id, rng.range(34, e.length - 34)));
      placed++;
    }
    const blocks = net.edges.filter((e) => net.edgeLine[e.id] === line && e.length >= MIN_OPENING_BLOCK);
    if (placed === 0 && blocks.length > 0) {
      const longest = blocks.reduce((a, b) => (b.length > a.length ? b : a));
      const jitter = Math.min(8, longest.length / 2 - MIN_OPENING_BLOCK / 2);
      net.openings.add(splitEdge(net, longest.id, longest.length / 2 + rng.range(-jitter, jitter)));
    }
  }
  net.trims = new Float64Array(net.edges.length * 2);
}
