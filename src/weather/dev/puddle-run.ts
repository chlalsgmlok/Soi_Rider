import type { CityQuery, Circle, Lane, TrafficQuery } from '../../core/types';

export interface PuddleRun {
  lane: Lane;
  /** where to start on the lane (m from its start) */
  s: number;
  puddle: Circle;
}

/**
 * Sandbox helper: a puddle that the lane cruiser's line (curb-lane edge) runs straight through, with a clear
 * run-up and no NPC parked on it — so a headless capture can watch a splash happen.
 */
export function findPuddleRun(city: CityQuery, traffic: TrafficQuery, puddles: readonly Circle[], from: { x: number; z: number }, runUp = 9): PuddleRun | null {
  const sorted = [...puddles].sort((a, b) => Math.hypot(a.cx - from.x, a.cz - from.z) - Math.hypot(b.cx - from.x, b.cz - from.z));
  const buf: Parameters<TrafficQuery['near']>[2] = [];
  for (const p of sorted) {
    const hit = city.nearestLane({ x: p.cx, z: p.cz }, 3);
    if (!hit) continue;
    const line = hit.lane.width / 2 - 0.62;
    if (Math.abs(hit.lateral - line) > p.r * 0.6 || hit.s < runUp + 8 || hit.lane.length - hit.s < 8) continue;
    const s = hit.s - runUp;
    const start = { x: hit.lane.start.x + hit.lane.dir.x * s, z: hit.lane.start.z + hit.lane.dir.z * s };
    if (traffic.near({ x: (start.x + p.cx) / 2, z: (start.z + p.cz) / 2 }, runUp, buf) > 0) continue;
    return { lane: hit.lane, s, puddle: p };
  }
  return null;
}
