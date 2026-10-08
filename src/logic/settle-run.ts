import type { JobOffer, RunConfig, RunResult, RunStats, SaveData } from '../core/types';
import { applyPayout } from './economy';
import { computeResult } from './scoring';

export interface SettledRun {
  /** the gram receipt; `newBest` compares against the save's best score from before this run */
  result: RunResult;
  /** the save with the payout booked (baht, trip counter, best score / grade); persisting it is the caller's job */
  save: SaveData;
}

/**
 * The finish line in one call (Play → Results): scores the run against the save's previous best, so `newBest` is set,
 * and books the payout. Pass stats that went through finalizeStats.
 */
export function settleRun(save: SaveData, config: RunConfig, job: JobOffer, stats: RunStats): SettledRun {
  const result = computeResult(config, job, stats, save.bestScore);
  return { result, save: applyPayout(save, result) };
}
