import type { POI, Vec2 } from '../../core/types';

/** a slow pass counts within this distance of the landmark's stop point (m) … */
export const LANDMARK_RADIUS = 32;
/** … at or below this speed (m/s, 15 km/h) … */
export const LANDMARK_SLOW = 15 / 3.6;
/** … for this long in total (s) */
export const LANDMARK_HOLD = 1.5;

/**
 * Tourist photo stops (docs/GAME_DESIGN.md §8 tourist, §10 CARE): riding slowly past a landmark POI pays once per
 * landmark. The run's own pickup / drop are excluded (stopping there is not sightseeing).
 */
export class LandmarkWatch {
  private readonly spots: POI[];
  private readonly done = new Set<number>();
  private near = -1;
  private slowFor = 0;

  constructor(pois: readonly POI[], exclude: readonly number[]) {
    this.spots = pois.filter((p) => p.landmark && !exclude.includes(p.id));
  }

  /** the landmark just enjoyed (once each), else null */
  update(dt: number, pos: Vec2, speed: number): POI | null {
    let cur: POI | null = null;
    let best = LANDMARK_RADIUS;
    for (const p of this.spots) {
      if (this.done.has(p.id)) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d <= best) {
        best = d;
        cur = p;
      }
    }
    if (!cur) {
      this.near = -1;
      this.slowFor = 0;
      return null;
    }
    if (cur.id !== this.near) {
      this.near = cur.id;
      this.slowFor = 0;
    }
    if (Math.abs(speed) <= LANDMARK_SLOW) this.slowFor += dt;
    if (this.slowFor < LANDMARK_HOLD) return null;
    this.done.add(cur.id);
    this.slowFor = 0;
    return cur;
  }
}
