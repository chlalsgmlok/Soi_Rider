import type { Vec2 } from '../../core/types';
import type { Tracks } from './tracks';

/** lane length represented by one sample (m) */
export const SAMPLE_LEN = 10;
/** density is kept within this radius of the rider when the budget allows (m) */
export const RING_MAX = 150;

export interface LaneSample {
  lane: number;
  /** arc length of the bin start */
  s: number;
  x: number;
  z: number;
  /** squared distance to the rider (refreshed by `sortAround`) */
  d2: number;
}

/**
 * Lane length around the rider, sampled every 10 m. Finds the radius inside which a density (vehicles per lane
 * metre) fits a vehicle budget, so a capped budget stays dense near the rider instead of thin everywhere.
 */
export class RingBudget {
  readonly samples: LaneSample[] = [];
  private readonly sorted: LaneSample[];

  constructor(tracks: Tracks) {
    for (const l of tracks.city.lanes) {
      for (let s = 0; s < l.length; s += SAMPLE_LEN) {
        const m = Math.min(l.length, s + SAMPLE_LEN / 2);
        this.samples.push({ lane: l.id, s, x: l.start.x + l.dir.x * m, z: l.start.z + l.dir.z * m, d2: 0 });
      }
    }
    this.sorted = this.samples.slice();
  }

  sortAround(p: Vec2): void {
    for (const k of this.samples) k.d2 = (k.x - p.x) ** 2 + (k.z - p.z) ** 2;
    this.sorted.sort((a, b) => a.d2 - b.d2);
  }

  /** lane metres within radius r (after sortAround) */
  laneMetres(r: number): number {
    const r2 = r * r;
    let n = 0;
    for (const k of this.sorted) {
      if (k.d2 > r2) break;
      n++;
    }
    return n * SAMPLE_LEN;
  }

  /** radius (≤ RING_MAX) holding `budget` vehicles at `perMetre` density, and the vehicle target there */
  fit(perMetre: number, budget: number): { radius: number; target: number } {
    if (perMetre <= 0 || budget <= 0) return { radius: RING_MAX, target: 0 };
    const max2 = RING_MAX * RING_MAX;
    let count = 0;
    for (const k of this.sorted) {
      if (k.d2 > max2) break;
      count += perMetre * SAMPLE_LEN;
      if (count >= budget) return { radius: Math.sqrt(k.d2), target: budget };
    }
    return { radius: RING_MAX, target: Math.round(count) };
  }

  /** random sample with distance in [r0, r1] (after sortAround), or null */
  pick(r0: number, r1: number, rnd: number): LaneSample | null {
    const a = this.lowerBound(r0 * r0);
    const b = this.lowerBound(r1 * r1);
    if (b <= a) return null;
    return this.sorted[a + Math.floor(rnd * (b - a))];
  }

  /**
   * Like `pick`, but the best of a few draws, favouring samples close to the rider and on lanes running toward the
   * rider: traffic streams into the area the camera sees instead of thinning out there (spawns are never visible).
   */
  pickToward(r0: number, r1: number, rnd: () => number, focus: Vec2, dirOf: (lane: number) => Vec2): LaneSample | null {
    let best: LaneSample | null = null;
    let bestW = -1;
    for (let i = 0; i < 4; i++) {
      const k = this.pick(r0, r1, rnd());
      if (!k) continue;
      const dir = dirOf(k.lane);
      const toward = (focus.x - k.x) * dir.x + (focus.z - k.z) * dir.z > 0;
      const w = (1.2 - Math.sqrt(k.d2) / Math.max(1, r1)) * (toward ? 1.8 : 1) * (0.75 + 0.5 * rnd());
      if (w > bestW) {
        bestW = w;
        best = k;
      }
    }
    return best;
  }

  private lowerBound(d2: number): number {
    let lo = 0;
    let hi = this.sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.sorted[mid].d2 < d2) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}
