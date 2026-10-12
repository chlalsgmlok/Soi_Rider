import type { AppCtx } from '../app-context';

/** RANKING: the online board (best score per rider) over the title backdrop; `back` returns to where it was opened */
export function showRanking(ctx: AppCtx, back: () => void): void {
  ctx.ui.show('ranking', {
    save: ctx.saves.save,
    load: () => ctx.leaderboard.view(ctx.saves.save),
    onBack: back,
  }, 'wipe', {
    onCovered: () => {
      ctx.state = 'ranking';
    },
  });
}
