/**
 * Sandbox data for the Results screen (sandbox/ui-play.html?view=results|results-fail). Runs the real scoring and
 * payout (src/logic settleRun) on hand-tuned stats so every grade / fail reason can be previewed. Not used by the game.
 */
import type { FailReason, Grade, RunConfig, RunStats } from '../../../core/types/game';
import type { ResultsProps } from '../../../core/types/screens';
import { STARTER_LOADOUT } from '../../../core/config/catalog';
import { createDefaultSave } from '../../../logic/save-defaults';
import { createRunStats } from '../../../logic/run-stats';
import { settleRun } from '../../../logic/settle-run';
import { DEMO_OFFERS } from '../intro/intro-demo';

const ETA = 200;

/** stat profiles that land on each grade with the hurry passenger (GAME_DESIGN §10) */
const PROFILE: Record<Exclude<Grade, 'F'>, Partial<RunStats>> = {
  S: { timeSec: 128, finalComfort: 96, stylePoints: 1460, nearMisses: 9, perfectGaps: 3, filterPasses: 6, maxCombo: 7, raincoat: 'given', smoothArrival: true },
  A: { timeSec: 176, finalComfort: 84, stylePoints: 820, nearMisses: 6, perfectGaps: 1, filterPasses: 3, maxCombo: 4, mirrorClips: 1, smoothArrival: true },
  B: { timeSec: 196, finalComfort: 74, stylePoints: 600, nearMisses: 5, maxCombo: 3, bumps: 1, mirrorClips: 2 },
  C: { timeSec: 205, finalComfort: 60, stylePoints: 300, nearMisses: 3, maxCombo: 2, bumps: 2, mirrorClips: 2, curbHits: 3 },
  D: { timeSec: 300, finalComfort: 31, stylePoints: 40, bumps: 3, mirrorClips: 4, falls: 2, pedScares: 2, redLights: 1, sidewalkSec: 7 },
};

const FAIL: Record<FailReason, Partial<RunStats>> = {
  comfort: { timeSec: 140, finalComfort: 0, bumps: 3, mirrorClips: 5, nearMisses: 7, stylePoints: 380 },
  falls: { timeSec: 120, finalComfort: 22, falls: 3, bumps: 2 },
  timeout: { timeSec: ETA * 2.5, finalComfort: 41, bumps: 1, counterflowSec: 4 },
  abandon: { timeSec: 90, finalComfort: 58 },
};

export function demoResultsProps(o: {
  grade: Exclude<Grade, 'F'>;
  fail: FailReason | null;
  best: boolean;
  on: { next(): void; garage(): void; title(): void };
}): ResultsProps {
  const job = DEMO_OFFERS[0];
  const config: RunConfig = {
    seed: 4242,
    tripNumber: 3,
    intensity: 'rush',
    timeOfDay: 'sunset',
    weather: { base: 'clear', haze: 0.1, events: [{ kind: 'downpour', atProgress: 0.4, duration: 80, intensity: 0.8 }] },
    district: 'sukhumvit',
    loadout: { ...STARTER_LOADOUT },
  };
  const base = createRunStats(ETA, job.estMeters, 80);
  const stats: RunStats = { ...base, ...(o.fail ? FAIL[o.fail] : PROFILE[o.grade]), failed: o.fail };
  const save = { ...createDefaultSave(), baht: 420, fuel: 4, tripsCompleted: 2, bestScore: o.best ? 3200 : 99999 };
  const settled = settleRun(save, config, job, stats);
  return { result: settled.result, save: settled.save, onNext: o.on.next, onGarage: o.on.garage, onTitle: o.on.title };
}
