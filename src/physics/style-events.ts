/** Raw style detections from StyleSensor (scored by logic/StyleTracker, see style-publish.ts). */
export type StyleEvent =
  | { kind: 'nearMiss'; clearanceCm: number; speedKmh: number; side: 'left' | 'right'; key: number }
  | { kind: 'perfectGap'; leftCm: number; rightCm: number; speedKmh: number; leftKey: number; rightKey: number }
  | { kind: 'filterPass'; id: number };

/** near miss: closest gap below this (m) … */
export const NEAR_MISS_GAP = 0.2;
/** … while riding faster than this (km/h) */
export const NEAR_MISS_KMH = 10;
/** perfect gap: both sides below this (m) at the same time */
export const PERFECT_GAP = 0.18;
export const PERFECT_GAP_KMH = 3;
/** an obstacle can only pay out once in this window (s) */
export const AWARD_COOLDOWN = 6;
/** filter pass: the overtaken vehicle is queued or slower than this (m/s) */
export const FILTER_SLOW = 2.5;
