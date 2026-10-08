import type { RunConfig, RunStats } from '../../core/types';
import { createRunStats } from '../../logic';
import { setTitleGate } from '../../ui/screens/title';
import type { AppCtx } from '../app-context';
import type { SkipTarget } from '../params';
import { forecastFor, runConfigFor } from '../run-plan';
import type { GameSession } from '../session/game-session';
import { quickRide } from './intro-flow';

/** the run `?skip=intro|play|results` starts: Setup's defaults plus the URL overrides (no fuel is spent) */
function defaultConfig(ctx: AppCtx): RunConfig {
  const { params, saves } = ctx;
  const intensity = params.intensity ?? 'rush';
  return runConfigFor(forecastFor(saves.save, params, intensity), intensity, saves.save.loadout, params);
}

/** a tidy, on-time trip for the receipt preview (?skip=results) */
function demoStats(session: GameSession): RunStats {
  const s = session.run?.mission.stats;
  const eta = s?.etaSec ?? 240;
  return {
    ...createRunStats(eta, s?.routeMeters ?? 1200, 84), timeSec: Math.round(eta * 0.86), nearMisses: 6, perfectGaps: 1,
    filterPasses: 5, maxCombo: 4, stylePoints: 720, bumps: 1, curbHits: 2, smoothArrival: true, finalComfort: 86,
  };
}

/** After BOOT: the title (press-any-key gate first), or straight into a state for QA (README › Debug parameters). */
export function startAt(ctx: AppCtx, skip: SkipTarget | null): void {
  if (skip) setTitleGate(false);
  if (skip === 'garage') ctx.nav.garage();
  else if (skip === 'setup') ctx.nav.setup();
  else if (skip === 'intro') ctx.nav.intro(defaultConfig(ctx));
  else if (skip === 'play') quickRide(ctx, defaultConfig(ctx));
  else if (skip === 'results') quickRide(ctx, defaultConfig(ctx), (finish, session) => finish(demoStats(session)));
  else ctx.nav.title();
}
