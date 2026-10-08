import { KMH } from '../core/math2d';
import type { ClearanceInfo, TrafficQuery } from '../core/types';
import type { ClearanceSample } from './clearance-sensor';
import type { ContactReport, SensedRider } from './collision-types';
import { FilterPassTracker } from './filter-pass';
import { PED_KEY } from './obstacle-scan';
import {
  AWARD_COOLDOWN, NEAR_MISS_GAP, NEAR_MISS_KMH, PERFECT_GAP, PERFECT_GAP_KMH, type StyleEvent,
} from './style-events';

interface PassTrack {
  start: number;
  seen: number;
  side: -1 | 1;
  minGap: number;
  /** fastest speed (km/h) while closer than the near-miss gap */
  speed: number;
}

interface PairTrack {
  start: number;
  left: number;
  right: number;
  leftKey: number;
  rightKey: number;
  speed: number;
}

/** what the sensor reads from ClearanceSensor */
export interface ClearanceFeed {
  readonly info: ClearanceInfo;
  readonly samples: readonly ClearanceSample[];
}

/**
 * Per-step style detection. An obstacle is judged when it leaves the rider's side (passed, or fell back out of
 * range): near miss if its closest gap was < 20 cm at > 10 km/h without touching it. A perfect gap is judged when
 * the rider stops being squeezed between two obstacles both < 18 cm away. Filter passes come from
 * FilterPassTracker. Each obstacle pays out at most once per AWARD_COOLDOWN. People never pay: buzzing a
 * pedestrian is a safety threat (GAME_DESIGN §10 SAFETY), not style.
 */
export class StyleSensor {
  readonly events: StyleEvent[] = [];
  private readonly passes = new Map<number, PassTrack>();
  private readonly touched = new Map<number, number>();
  private readonly awarded = new Map<number, number>();
  private readonly filter = new FilterPassTracker();
  private pair: PairTrack | null = null;
  private time = 0;

  reset(): void {
    this.passes.clear();
    this.touched.clear();
    this.awarded.clear();
    this.filter.reset();
    this.pair = null;
  }

  step(dt: number, rider: SensedRider, clearance: ClearanceFeed, contacts: readonly ContactReport[], traffic: TrafficQuery | null): StyleEvent[] {
    this.time += dt;
    const t = this.time;
    this.events.length = 0;
    const s = rider.state;
    const kmh = Math.abs(s.speed) * KMH;
    for (const c of contacts) if (c.key >= 0) this.touched.set(c.key, t);
    if (s.fallen) {
      this.passes.clear();
      this.pair = null;
      return this.events;
    }
    this.trackPair(t, clearance.info, kmh);
    for (const smp of clearance.samples) {
      if (smp.gap >= NEAR_MISS_GAP * 2.5 || smp.source === 'ped') continue;
      let p = this.passes.get(smp.key);
      if (!p) {
        p = { start: t, seen: t, side: smp.side, minGap: smp.gap, speed: 0 };
        this.passes.set(smp.key, p);
      }
      p.seen = t;
      if (smp.gap < p.minGap) {
        p.minGap = smp.gap;
        p.side = smp.side;
      }
      if (smp.gap < NEAR_MISS_GAP) p.speed = Math.max(p.speed, kmh);
    }
    for (const [key, p] of this.passes) {
      if (p.seen === t) continue;
      this.passes.delete(key);
      if (p.minGap < NEAR_MISS_GAP && p.speed > NEAR_MISS_KMH && this.clean(key, p.start)) {
        this.awarded.set(key, t);
        this.events.push({ kind: 'nearMiss', clearanceCm: p.minGap * 100, speedKmh: p.speed, side: p.side < 0 ? 'left' : 'right', key });
      }
    }
    this.filter.step(t, rider, traffic, this.events);
    this.prune(t);
    return this.events;
  }

  private trackPair(t: number, info: ClearanceInfo, kmh: number): void {
    const squeezed = info.left < PERFECT_GAP && info.right < PERFECT_GAP && info.leftId !== info.rightId
      && info.leftId < PED_KEY && info.rightId < PED_KEY;
    const pr = this.pair;
    if (squeezed && pr && pr.leftKey === info.leftId && pr.rightKey === info.rightId) {
      pr.left = Math.min(pr.left, info.left);
      pr.right = Math.min(pr.right, info.right);
      pr.speed = Math.max(pr.speed, kmh);
      return;
    }
    if (pr) this.judgePair(pr, t);
    this.pair = squeezed ? { start: t, left: info.left, right: info.right, leftKey: info.leftId, rightKey: info.rightId, speed: kmh } : null;
  }

  private judgePair(pr: PairTrack, t: number): void {
    if (pr.speed <= PERFECT_GAP_KMH || !this.clean(pr.leftKey, pr.start) || !this.clean(pr.rightKey, pr.start)) return;
    // the pair pays out instead of two separate near misses
    this.awarded.set(pr.leftKey, t);
    this.awarded.set(pr.rightKey, t);
    this.events.push({
      kind: 'perfectGap', leftCm: pr.left * 100, rightCm: pr.right * 100, speedKmh: pr.speed,
      leftKey: pr.leftKey, rightKey: pr.rightKey,
    });
  }

  /** not touched since shortly before the pass began and not paid out recently */
  private clean(key: number, start: number): boolean {
    const touch = this.touched.get(key);
    if (touch !== undefined && touch >= start - 0.5) return false;
    const paid = this.awarded.get(key);
    return paid === undefined || this.time - paid > AWARD_COOLDOWN;
  }

  private prune(t: number): void {
    for (const [k, v] of this.touched) if (t - v > AWARD_COOLDOWN) this.touched.delete(k);
    for (const [k, v] of this.awarded) if (t - v > AWARD_COOLDOWN) this.awarded.delete(k);
  }
}
