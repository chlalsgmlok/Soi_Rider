import type { TurnKind, Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { Tracks } from './tracks';
import type { Vehicle } from './vehicle';

/** relative appetite for each movement at a junction */
const TURN_WEIGHT: Record<TurnKind, number> = { straight: 1, left: 0.42, right: 0.3, uturn: 0.07 };
/** route pieces planned ahead (connector, lane, connector) — enough for a 70 m lookahead */
const PLAN = 3;
/** beyond this distance from the rider, routes lean toward the rider so the ring stays populated */
const PULL_DIST = 70;

/**
 * Random route choice at junctions: when the plan runs short, pick one of the legal connectors leaving the last
 * planned lane (weighted by movement; far from the rider, movements heading back toward the rider are favoured).
 */
export function extendRoute(v: Vehicle, tracks: Tracks, rng: Rng, focus: Vec2): void {
  let last = v.route.length > 0 ? v.route[v.route.length - 1] : v.track;
  while (v.route.length < PLAN) {
    const t = tracks.get(last);
    if (t.next.length === 0) return;
    let next = t.next[0];
    if (t.next.length > 1) {
      const end = t.pts[t.pts.length - 1];
      const far = Math.hypot(end.x - focus.x, end.z - focus.z) > PULL_DIST;
      next = rng.weighted(t.next, (id) => {
        const c = tracks.get(id);
        let w = TURN_WEIGHT[c.turn ?? 'straight'];
        // city buses keep to the main roads — their 11.5 m sweep does not fit soi mouths
        if (v.kind === 'bus' && tracks.city.edges[tracks.get(c.next[0]).edge].cls === 'soi') w *= 0.001;
        if (far) {
          const p = c.pts[c.pts.length - 1];
          const q = c.pts[Math.max(0, c.pts.length - 2)];
          const dx = p.x - q.x;
          const dz = p.z - q.z;
          const l = Math.hypot(dx, dz) || 1;
          const tx = focus.x - p.x;
          const tz = focus.z - p.z;
          const lt = Math.hypot(tx, tz) || 1;
          w *= 1 + 0.9 * Math.max(0, (dx * tx + dz * tz) / (l * lt));
        }
        return w;
      });
    }
    v.route.push(next);
    last = next;
  }
}

/** forget the plan (after a lane change) and plan again from the current track */
export function replan(v: Vehicle, tracks: Tracks, rng: Rng, focus: Vec2): void {
  v.route.length = 0;
  extendRoute(v, tracks, rng, focus);
}
