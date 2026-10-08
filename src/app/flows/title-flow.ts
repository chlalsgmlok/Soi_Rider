import type { Transition } from '../../core/types';
import type { AppCtx } from '../app-context';
import { menuAmbience } from './menu-ambience';

/** TITLE: the living junction diorama behind the logo menu (시작 · 차고 · 상점 · 설정), wallet + fuel up top */
export function showTitle(ctx: AppCtx, transition: Transition = 'wipe'): void {
  ctx.ui.show('title', {
    save: ctx.saves.save,
    onStart: () => ctx.nav.setup(),
    onGarage: () => ctx.nav.garage(),
    onShop: () => ctx.nav.shop(() => ctx.nav.title()),
    onSettings: () => ctx.nav.settings(),
  }, transition, {
    onCovered: () => {
      ctx.endSession();
      const title = ctx.backdrops.title;
      if (title) ctx.showBackdrop(title);
      ctx.state = 'title';
      ctx.music('title');
      menuAmbience(ctx.audio, 'street');
    },
  });
}
