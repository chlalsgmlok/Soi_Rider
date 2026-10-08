import { itemById } from '../core/config/catalog';
import { Rng } from '../core/rng';
import type { JobOffer, RunConfig, RunResult, RunStats } from '../core/types';
import { passengerComment } from './comments';
import { computeEarnings } from './earnings';
import { gradeFor, starsFor } from './grade';
import { isFemalePassenger } from './passengers';
import { buildScoreLines } from './score-lines';

/**
 * Turns a finished run into the gram receipt (docs/GAME_DESIGN.md §10–§11).
 * A failed run (stats.failed set) scores delivery/time 0, is graded F, rated 1 star and pays 0 ฿; the other lines are
 * still itemised so the player sees what went wrong, and a final '운행 실패' line cancels them so the total is 0.
 * `prevBestScore` (the save's bestScore before payout) enables `newBest`; without it `newBest` is false. The app should
 * normally call settleRun (settle-run.ts), which passes it and books the payout in one step.
 */
export function computeResult(config: RunConfig, job: JobOffer, stats: RunStats, prevBestScore?: number): RunResult {
  const failed = stats.failed !== null;
  const trait = job.passenger.trait;
  const lines = buildScoreLines(stats, trait);
  const earned = lines.reduce((sum, l) => sum + l.value, 0);
  if (failed && earned !== 0) lines.push({ key: 'penalty', label: '운행 실패', value: -earned, detail: '실패한 운행은 점수가 남지 않아요' });
  const total = failed ? 0 : earned;
  const seat = itemById(`gear:${config.loadout.gear}`);
  const comfortLine = seat?.perk ? lines.find((l) => l.key === 'comfort') : undefined;
  if (comfortLine && seat) comfortLine.detail += ` · ${seat.name}`;
  const grade = gradeFor(total, failed);
  const late = stats.etaSec > 0 && stats.timeSec > stats.etaSec;
  const money = computeEarnings(job, stats, grade);
  const rng = new Rng(config.seed).fork(`comment:${config.tripNumber}`);

  return {
    config,
    job,
    stats: { ...stats },
    lines,
    total,
    grade,
    stars: starsFor(stats.finalComfort, late, failed),
    fareBaht: money.fareBaht,
    tipBaht: money.tipBaht,
    bonusBaht: money.bonusBaht,
    totalBaht: money.totalBaht,
    passengerComment: passengerComment(rng, grade, trait, stats.failed, isFemalePassenger(job.passenger)),
    newBest: !failed && prevBestScore !== undefined && total > prevBestScore,
  };
}
