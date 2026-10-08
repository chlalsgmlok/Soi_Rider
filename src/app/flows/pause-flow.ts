import type { AppCtx } from '../app-context';
import type { GameSession } from '../session/game-session';

/** how much the world is muffled behind the pause sheet */
const PAUSE_MUFFLE = 0.85;

/**
 * PAUSE (Esc / P / Start while riding): the simulation freezes (frames keep drawing), the world goes muffled and the
 * frosted sheet offers 계속 달리기 · 다시 시작 (same call from the win stand) · 설정 · 나가기 (the call fails).
 */
export function openPause(ctx: AppCtx, session: GameSession): void {
  if (ctx.state !== 'play' || ctx.session !== session || session.paused || session.ending) return;
  session.paused = true;
  ctx.pauseLoop(true);
  ctx.engine.endAutoQuality();
  ctx.audio.muffle(PAUSE_MUFFLE);
  ctx.input.setTouchControls(false);
  ctx.state = 'pause';
  const resume = (): void => {
    if (ctx.session !== session) return;
    session.paused = false;
    session.control.reset();
    ctx.pauseLoop(false);
    ctx.engine.beginAutoQuality();
    ctx.audio.muffle(0);
    ctx.input.setTouchControls(ctx.saves.save.settings.touch);
    ctx.state = 'play';
  };
  const handle = ctx.ui.show('pause', {
    onResume: () => {
      void handle.close();
      resume();
    },
    onRestart: () => {
      void handle.close();
      void ctx.ui.transition('wipe', () => {
        ctx.ui.hud.reset();
        session.restart();
        resume();
      });
    },
    onSettings: () => ctx.nav.settings(),
    onQuit: () => {
      void handle.close();
      resume();
      session.abandon();
    },
  }, 'none');
}
