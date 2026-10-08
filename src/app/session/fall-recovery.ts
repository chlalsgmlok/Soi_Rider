import { clamp, headingOf } from '../../core/math2d';
import type { CityQuery, TrafficAgentView, TrafficQuery, Vec2 } from '../../core/types';
import { obbCircleGap } from '../../physics/obb-gap';
import { DRIVABLE } from '../../world/surface-map';

/** how far from the fall the rider may be moved (m) */
const SEARCH = 14;
/** free radius around the bike needed to get going again (m) */
const ROOM = 1.1;
/** candidate offsets along the nearest lane (m), nearest first */
const ALONG = [0, -3, 3, -6, 6, -9, 9, -12];

/**
 * After a fall the rider gets up where they landed — unless that spot is no place to ride off from (wedged against a
 * car, on a pavement, inside a building edge). Then the bike is moved to the nearest free point on the nearest lane,
 * facing the lane's direction (docs/GAME_DESIGN.md §8: falls cost comfort, not the run).
 */
export class FallRecovery {
  private readonly near: TrafficAgentView[] = [];
  private readonly probe = { cx: 0, cz: 0, r: ROOM };

  constructor(private readonly city: CityQuery, private readonly traffic: TrafficQuery | null) {}

  /** a safe pose near `pos`, or null when `pos` itself is fine (or nothing better exists) */
  find(pos: Vec2): { pos: Vec2; heading: number } | null {
    if (this.free(pos.x, pos.z)) return null;
    const hit = this.city.nearestLane(pos, SEARCH);
    if (!hit) return null;
    const lane = hit.lane;
    for (const d of ALONG) {
      const s = clamp(hit.s + d, 1, Math.max(1, lane.length - 1));
      const x = lane.start.x + lane.dir.x * s;
      const z = lane.start.z + lane.dir.z * s;
      if (this.free(x, z)) return { pos: { x, z }, heading: headingOf(lane.dir) };
    }
    return null;
  }

  private free(x: number, z: number): boolean {
    if (!(DRIVABLE & (1 << this.city.surfaceAt(x, z)))) return false;
    if (!this.traffic) return true;
    this.probe.cx = x;
    this.probe.cz = z;
    const n = this.traffic.near({ x, z }, ROOM + 6, this.near);
    for (let i = 0; i < n; i++) if (obbCircleGap(this.near[i].obb, this.probe) < 0.25) return false;
    return true;
  }
}
