import { SCORE } from '../core/config/scoring';

/**
 * Style points and combos (docs/GAME_DESIGN.md §10 STYLE).
 * - near miss (gap < 20 cm at > 10 km/h): 40 × multiplier
 * - perfect gap (both sides < 18 cm): 150 × multiplier
 * - filter pass (overtaking a queued vehicle): flat +15, neither extends nor breaks a combo
 * A near miss / perfect gap within 2.5 s (inclusive) of the previous one raises `combo` by 1; the multiplier is
 * `min(3, 1 + 0.25 · combo)`. The run total is capped at 3000 — awards are clipped to what is left under the cap.
 */
export interface StyleUpdate {
  /** points actually awarded by this call (0 for update, or when capped / not qualifying) */
  points: number;
  /** combo after this call */
  combo: number;
  /** a chain with combo ≥ 1 ended during this call */
  ended: boolean;
  /** combo value of the chain that ended (0 when none ended) */
  endedCombo: number;
}

/** below this speed a "perfect gap" is just walking the bike through — no points */
export const PERFECT_GAP_MIN_KMH = 3;

export class StyleTracker {
  total = 0;
  combo = 0;
  maxCombo = 0;
  nearMisses = 0;
  perfectGaps = 0;
  filterPasses = 0;
  private chainActive = false;
  private sinceLast = 0;

  get multiplier(): number {
    return Math.min(SCORE.comboMaxMult, 1 + SCORE.comboStep * this.combo);
  }

  /** advance the combo clock; reports when a combo times out */
  update(dt: number): StyleUpdate {
    if (!this.chainActive) return this.result(0, 0);
    this.sinceLast += dt;
    return this.result(0, this.expire());
  }

  /** returns null when the pass does not qualify (gap ≥ 20 cm or speed ≤ 10 km/h) */
  nearMiss(clearanceCm: number, speedKmh: number): StyleUpdate | null {
    if (!(clearanceCm < SCORE.nearMissCm) || !(speedKmh > SCORE.nearMissMinKmh)) return null;
    const ended = this.chain();
    this.nearMisses += 1;
    return this.result(this.award(SCORE.nearMiss * this.multiplier), ended);
  }

  /** returns null unless both sides are < 18 cm and the bike is actually riding */
  perfectGap(leftCm: number, rightCm: number, speedKmh: number): StyleUpdate | null {
    if (!(leftCm < SCORE.perfectGapCm) || !(rightCm < SCORE.perfectGapCm) || !(speedKmh > PERFECT_GAP_MIN_KMH)) return null;
    const ended = this.chain();
    this.perfectGaps += 1;
    return this.result(this.award(SCORE.perfectGap * this.multiplier), ended);
  }

  filterPass(): StyleUpdate {
    this.filterPasses += 1;
    return this.result(this.award(SCORE.filterPass), 0);
  }

  /** ends the current chain immediately (fall, crash) and reports it */
  breakCombo(): StyleUpdate {
    const ended = this.chainActive ? this.combo : 0;
    this.chainActive = false;
    this.combo = 0;
    return this.result(0, ended);
  }

  /** extends the chain or starts a new one; returns the combo of a chain that had already expired (0 = none) */
  private chain(): number {
    const ended = this.expire();
    if (this.chainActive) this.combo += 1;
    else {
      this.chainActive = true;
      this.combo = 0;
    }
    this.sinceLast = 0;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    return ended;
  }

  /** closes the chain if the window has passed; returns its combo (0 when still open or nothing to end) */
  private expire(): number {
    if (!this.chainActive || this.sinceLast <= SCORE.comboWindow) return 0;
    const ended = this.combo;
    this.chainActive = false;
    this.combo = 0;
    return ended;
  }

  private award(raw: number): number {
    const pts = Math.max(0, Math.min(Math.round(raw), SCORE.styleCap - this.total));
    this.total += pts;
    return pts;
  }

  private result(points: number, endedCombo: number): StyleUpdate {
    return { points, combo: this.combo, ended: endedCombo >= 1, endedCombo: endedCombo >= 1 ? endedCombo : 0 };
  }
}
