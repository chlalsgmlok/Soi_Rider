import { COMFORT } from '../core/config/scoring';
import type { CollisionKind } from '../core/events';
import type { CareOutcome, FailReason, RunStats } from '../core/types';
import { finiteOr } from './finite';
import type { StyleTracker } from './style';

/** what the receipt needs from the passenger's ComfortModel */
export interface ComfortReading {
  readonly value: number;
  readonly failed: boolean;
}

const clampComfort = (v: number, fallback: number): number => Math.min(100, Math.max(0, finiteOr(v, fallback)));

/**
 * Per-run statistics accumulator (input of scoring.computeResult). The updaters mutate the stats object in place on
 * purpose: they run inside the fixed 60 Hz step and must not allocate.
 * Lifecycle: `createRunStats(eta, metres, startingComfort(helmet))` → updaters every step → `finalizeStats` →
 * `settleRun` / `computeResult`.
 */
export function createRunStats(etaSec = 0, routeMeters = 0, startComfort: number = COMFORT.start): RunStats {
  return {
    timeSec: 0,
    etaSec,
    routeMeters,
    falls: 0,
    bumps: 0,
    mirrorClips: 0,
    pedScares: 0,
    curbHits: 0,
    redLights: 0,
    nearMisses: 0,
    perfectGaps: 0,
    filterPasses: 0,
    maxCombo: 0,
    stylePoints: 0,
    counterflowSec: 0,
    sidewalkSec: 0,
    raincoat: 'na',
    mask: 'na',
    smoothArrival: false,
    landmarkBonus: 0,
    finalComfort: clampComfort(startComfort, COMFORT.start),
    failed: null,
  };
}

/** counts a collision report: mirror clips, curb strikes, pedestrian scares; every other contact is a body bump */
export function recordContact(stats: RunStats, kind: CollisionKind): void {
  switch (kind) {
    case 'mirror':
      stats.mirrorClips += 1;
      break;
    case 'curb':
      stats.curbHits += 1;
      break;
    case 'pedestrian':
      stats.pedScares += 1;
      break;
    default:
      stats.bumps += 1;
  }
}

export const recordFall = (stats: RunStats): void => {
  stats.falls += 1;
};

/** a pedestrian forced to jump back (or splashed) without contact */
export const recordPedScare = (stats: RunStats): void => {
  stats.pedScares += 1;
};

export const recordRedLight = (stats: RunStats): void => {
  stats.redLights += 1;
};

/** one slow pass by a landmark with a tourist on board (`landmarkBonus` counts passes; scoring awards 150 each, max 3) */
export const recordLandmark = (stats: RunStats): void => {
  stats.landmarkBonus += 1;
};

/** raincoat / mask offer result; a "given" is never downgraded by a later prompt */
export function recordCare(stats: RunStats, which: 'raincoat' | 'mask', outcome: CareOutcome): void {
  if (stats[which] !== 'given') stats[which] = outcome;
}

export function tickRunStats(stats: RunStats, dt: number, flags: { counterflow: boolean; sidewalk: boolean }): void {
  if (!(dt > 0) || !Number.isFinite(dt)) return;
  stats.timeSec += dt;
  if (flags.counterflow) stats.counterflowSec += dt;
  if (flags.sidewalk) stats.sidewalkSec += dt;
}

/** copies style counters from the tracker (call before scoring, or whenever the HUD needs them) */
export function syncStyle(stats: RunStats, style: Readonly<StyleTracker>): void {
  stats.nearMisses = style.nearMisses;
  stats.perfectGaps = style.perfectGaps;
  stats.filterPasses = style.filterPasses;
  stats.maxCombo = style.maxCombo;
  stats.stylePoints = style.total;
}

/** fail rules (§8): comfort 0 → passenger gets off; 3 falls; more than 2.5 × ETA → the call is cancelled */
export function failReasonFor(stats: RunStats, comfortFailed: boolean): FailReason | null {
  if (stats.failed) return stats.failed;
  if (comfortFailed) return 'comfort';
  if (stats.falls >= COMFORT.maxFalls) return 'falls';
  if (stats.etaSec > 0 && stats.timeSec > stats.etaSec * COMFORT.timeoutFactor) return 'timeout';
  return null;
}

/**
 * End of the run in one call, so no step can be forgotten: copies the style counters, records the passenger's final
 * comfort (kept as is when the reading is not a number) and settles the fail reason (an `abandon` set earlier wins).
 * Returns the same stats object, ready for settleRun / computeResult.
 */
export function finalizeStats(stats: RunStats, comfort: ComfortReading, style: Readonly<StyleTracker>): RunStats {
  syncStyle(stats, style);
  stats.finalComfort = clampComfort(comfort.value, stats.finalComfort);
  stats.failed = failReasonFor(stats, comfort.failed);
  return stats;
}
