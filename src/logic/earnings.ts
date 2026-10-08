import { FARE, TIP_RATE } from '../core/config/scoring';
import { INTENSITY } from '../core/config/traffic';
import type { Grade, JobOffer, RunStats, TrafficIntensity } from '../core/types';
import { finiteOr } from './finite';

/** Money side of a trip (docs/GAME_DESIGN.md §8 traits, §11 economy). */

/** `40 + metres × 0.08 × intensity multiplier`, rounded; negative or non-finite metres count as 0 */
export const fareFor = (meters: number, intensity: TrafficIntensity): number =>
  Math.round(FARE.base + Math.max(0, finiteOr(meters)) * FARE.perMeter * INTENSITY[intensity].fareMult);

/** trait money modifiers: nervous riders tip more for a smooth ride, regulars tip less but add a loyalty bonus */
export const TRAIT_MONEY = {
  nervousSmoothComfort: 85,
  nervousSmoothTipMult: 1.5,
  regularTipMult: 0.5,
  regularBonus: 30,
} as const;

export interface Earnings {
  fareBaht: number;
  /** grade tip + raincoat/mask tips */
  tipBaht: number;
  /** regular-customer loyalty bonus */
  bonusBaht: number;
  totalBaht: number;
}

export function tipRateFor(job: JobOffer, stats: RunStats, grade: Grade): number {
  const base = TIP_RATE[grade];
  switch (job.passenger.trait) {
    case 'nervous':
      return stats.finalComfort >= TRAIT_MONEY.nervousSmoothComfort ? base * TRAIT_MONEY.nervousSmoothTipMult : base;
    case 'regular':
      return base * TRAIT_MONEY.regularTipMult;
    default:
      return base;
  }
}

/** a failed run (grade F) pays nothing */
export function computeEarnings(job: JobOffer, stats: RunStats, grade: Grade): Earnings {
  if (grade === 'F' || stats.failed !== null) return { fareBaht: 0, tipBaht: 0, bonusBaht: 0, totalBaht: 0 };
  const fareBaht = Math.max(0, Math.round(finiteOr(job.fareBaht)));
  const careTip = (stats.raincoat === 'given' ? FARE.raincoatTip : 0) + (stats.mask === 'given' ? FARE.maskTip : 0);
  const tipBaht = Math.round(fareBaht * tipRateFor(job, stats, grade)) + careTip;
  const bonusBaht = job.passenger.trait === 'regular' ? TRAIT_MONEY.regularBonus : 0;
  return { fareBaht, tipBaht, bonusBaht, totalBaht: fareBaht + tipBaht + bonusBaht };
}
