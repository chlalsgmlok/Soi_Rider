import { BIKES } from '../../core/config/bikes';
import { KMH } from '../../core/math2d';
import type { JobOffer, PlayerInput, RunStats } from '../../core/types';
import { mapSourceFromCity } from '../../ui';
import type { AppCtx, Stage } from '../app-context';
import type { GameSession } from '../session/game-session';
import type { RunStart } from '../session/session-run';
import { openPause } from './pause-flow';
import { showResults } from './results-flow';

/** ends the ride into the receipt; QA passes demo stats (?skip=results) */
export type FinishRun = (demo?: RunStats) => void;

/** key-cap label of the interact control in the story prompts, by the device the player last used */
const INTERACT_KEY: Readonly<Record<PlayerInput['device'], string>> = { keyboard: 'E', gamepad: 'A', touch: '탭' };

/** the run on screen: session visuals before the render, the HUD snapshot after it (PLAY steps 6–9) */
function rideStage(ctx: AppCtx, session: GameSession): Stage {
  return {
    frame: (dt) => session.frame(dt),
    after: () => {
      const hud = session.hud(innerWidth, innerHeight);
      if (hud) ctx.ui.hud.update(hud);
    },
  };
}

/**
 * PLAY (called under the crosswalk wipe that reveals the HUD): the HUD is configured for the bike, the time of day
 * and the run's city map; the job starts from the win stand; Esc / P pauses; the end of the attempt leads to the
 * receipt. Touch controls show while riding (Settings.touch) and 'auto' quality may step down.
 */
export function startPlay(ctx: AppCtx, session: GameSession, job: JobOffer, start: RunStart): FinishRun {
  const { ui, engine } = ctx;
  const settings = ctx.saves.save.settings;
  const cfg = session.config;
  ui.hud.reset();
  ui.hud.configure({ topSpeedKmh: BIKES[cfg.loadout.bike].topSpeed * KMH, timeOfDay: cfg.timeOfDay, minimap: settings.minimap });
  ui.hud.setMapSource(mapSourceFromCity(session.world.data));
  const unbindHud = ui.hud.bind(ctx.bus);
  const unbindStory = ctx.story.bindPrompts(ctx.bus);
  const unbind = (): void => {
    unbindHud();
    unbindStory();
  };
  session.beginRide(job, start, INTERACT_KEY[ctx.input.lastDevice]);
  session.onPauseKey = () => openPause(ctx, session);
  const finish: FinishRun = (demo) => showResults(ctx, session, unbind, { demo });
  session.onFinished = () => finish();
  ctx.setStage(rideStage(ctx, session));
  ctx.input.setTouchControls(settings.touch);
  engine.beginAutoQuality();
  ctx.state = 'play';
  return finish;
}
