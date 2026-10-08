import type { Forecast, TrafficIntensity } from '../../core/types';
import { claimFreeRefill, freeRefillAvailable, startRun } from '../../logic';
import type { AppCtx } from '../app-context';
import { forecastFor, rerolled, runConfigFor } from '../run-plan';
import { buyItem } from './garage-flow';
import { menuAmbience } from './menu-ambience';

/**
 * SETUP: traffic intensity cards + today's Bangkok forecast (one free reroll) → 출근하기 burns one fuel and freezes
 * the run config. An empty tank turns the go panel into fuel packs and Aunt Lek's free refill (every few trips).
 */
export function showSetup(ctx: AppCtx): void {
  const { params, saves } = ctx;
  let intensity: TrafficIntensity = params.intensity ?? 'rush';
  let forecast: Forecast = forecastFor(saves.save, params, intensity);
  const handle = ctx.ui.show('setup', {
    save: saves.save,
    forecast,
    onReroll: () => {
      const next = rerolled(forecast, params, intensity);
      if (next) forecast = next;
      return next;
    },
    onIntensity: (i) => {
      intensity = i;
    },
    onGo: (i) => {
      const res = startRun(saves.save);
      if (!res.ok) {
        ctx.ui.toast('연료가 없어요 — 주유하고 출근해요', 'warn', 'fuel');
        return;
      }
      const save = saves.commit(res.save);
      ctx.nav.intro(runConfigFor(forecast, i, save.loadout, params));
    },
    onBack: () => ctx.nav.title(),
    onBuyFuel: (id) => {
      const res = buyItem(ctx, id);
      if (res.ok) handle.update({ save: res.save, freeRefillAvailable: freeRefillAvailable(res.save) });
      return res;
    },
    freeRefillAvailable: freeRefillAvailable(saves.save),
    onFreeRefill: () => {
      const save = saves.commit(claimFreeRefill(saves.save));
      handle.update({ save, freeRefillAvailable: false });
      return save;
    },
  }, 'wipe', {
    onCovered: () => {
      ctx.endSession();
      const title = ctx.backdrops.title;
      if (title) ctx.showBackdrop(title);
      ctx.state = 'setup';
      ctx.music('title');
      menuAmbience(ctx.audio, 'street');
    },
  });
}
