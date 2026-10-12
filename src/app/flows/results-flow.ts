import type { RunStats } from '../../core/types';
import { settleRun } from '../../logic';
import type { AppCtx } from '../app-context';
import type { GameSession } from '../session/game-session';

export interface ResultsOptions {
  /** QA (?skip=results): score these stats instead of the mission's and do not book the payout */
  demo?: RunStats;
}

/**
 * RESULTS: the attempt is scored against the save's best (settleRun), the payout booked and persisted, 'run:complete'
 * announced (audio's S stinger), and the gram receipt prints over the parked rider while the camera orbits.
 */
export function showResults(ctx: AppCtx, session: GameSession, unbindHud: () => void, opts: ResultsOptions = {}): void {
  const run = session.run;
  const job = session.job;
  if (!run || !job || ctx.session !== session) return;
  const settled = settleRun(ctx.saves.save, session.config, job, opts.demo ?? run.mission.finalStats());
  const save = opts.demo ? settled.save : ctx.saves.commit(settled.save);
  ctx.lastResult = settled.result;
  ctx.bus.emit('run:complete', settled.result);
  if (!opts.demo && settled.result.newBest) {
    void ctx.leaderboard.sync(save).then((rank) => {
      if (rank) ctx.ui.toast(`최고 기록 등록! 온라인 순위 ${rank}위`, 'good', 'trophy');
    }).catch(() => undefined);
  }
  ctx.input.setTouchControls(false);
  ctx.engine.endAutoQuality();
  ctx.backdrops.setTitleTime(session.config.timeOfDay);
  ctx.ui.show('results', {
    result: settled.result,
    save,
    onNext: () => ctx.nav.setup(),
    onGarage: () => ctx.nav.garage(),
    onTitle: () => ctx.nav.title(),
  }, 'wipe', {
    onCovered: () => {
      unbindHud();
      ctx.ui.hud.reset();
      session.outro();
      ctx.state = 'results';
      ctx.music('results');
    },
  });
}
