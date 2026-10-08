import { angleDiff } from '../core/math2d';
import type { TrafficAgentView, TrafficQuery } from '../core/types';
import type { SensedRider } from './collision-types';
import { FILTER_SLOW, type StyleEvent } from './style-events';

interface Track {
  behind: boolean;
  seen: number;
}

/** lateral corridor (m) beside a vehicle in which overtaking counts as filtering */
const CORRIDOR = 3.6;
/** the rider must be this much faster than the vehicle (m/s) */
const MARGIN = 1.2;
/** one award per vehicle in this window (s) */
const COOLDOWN = 15;

/**
 * Filter-pass detection: the rider goes from behind a queued or crawling vehicle to ahead of it, travelling the same
 * way inside a narrow corridor beside it. Measured in the VEHICLE's frame, so the rider's own turning does not matter.
 */
export class FilterPassTracker {
  private readonly tracks = new Map<number, Track>();
  private readonly awarded = new Map<number, number>();
  private readonly near: TrafficAgentView[] = [];

  reset(): void {
    this.tracks.clear();
    this.awarded.clear();
  }

  step(time: number, rider: SensedRider, traffic: TrafficQuery | null, out: StyleEvent[]): void {
    if (!traffic) return;
    const s = rider.state;
    traffic.near(s.pos, 9, this.near);
    for (const a of this.near) {
      const crawling = a.speed > 0.3 && a.speed < FILTER_SLOW; // parked cars (never moving, not queued) don't count
      if (!(a.queued || crawling) || Math.abs(angleDiff(a.heading, s.heading)) > 0.7) {
        this.tracks.delete(a.id);
        continue;
      }
      const fx = Math.sin(a.heading);
      const fz = Math.cos(a.heading);
      const dx = s.pos.x - a.pos.x;
      const dz = s.pos.z - a.pos.z;
      const along = dx * fx + dz * fz;
      const lateral = Math.abs(-dx * fz + dz * fx);
      if (lateral > CORRIDOR) {
        this.tracks.delete(a.id);
        continue;
      }
      const hl = a.spec.length / 2 + 0.3;
      let t = this.tracks.get(a.id);
      if (!t) {
        t = { behind: false, seen: time };
        this.tracks.set(a.id, t);
      }
      t.seen = time;
      if (along < -hl) t.behind = true;
      else if (t.behind && along > hl) {
        t.behind = false;
        const last = this.awarded.get(a.id);
        if (s.speed > a.speed + MARGIN && !s.fallen && (last === undefined || time - last > COOLDOWN)) {
          this.awarded.set(a.id, time);
          out.push({ kind: 'filterPass', id: a.id });
        }
      }
    }
    for (const [id, t] of this.tracks) if (time - t.seen > 1) this.tracks.delete(id);
    for (const [id, t] of this.awarded) if (time - t > COOLDOWN) this.awarded.delete(id);
  }
}
