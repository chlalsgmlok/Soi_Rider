import { ASSET_NAMES } from '../../engine';
import { reducedMotion } from '../../ui';
import { preloadCityFonts } from '../../world';
import type { AppCtx } from '../app-context';

/** boot screen copy, advancing with the load (the last one holds while the title diorama is built) */
const LABELS = ['방콕 지도를 펼치는 중…', '택시와 툭툭을 도로에 올리는 중…', '노점 불을 켜는 중…', '손님들이 콜을 부르는 중…', '출발 준비 완료!'];
/** share of the bar the model downloads fill; the rest is the title city build */
const MODELS_SHARE = 0.82;

const nextPaint = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

/**
 * BOOT: the scooter loading bar while every model (≈ 5 MB of GLBs) and the sign fonts load, then the title diorama
 * is built (city, traffic pre-roll) so the title appears alive. Later screens never wait for downloads.
 */
export async function runBoot(ctx: AppCtx): Promise<void> {
  ctx.state = 'boot';
  const screen = ctx.ui.show('boot', { progress: 0, label: LABELS[0] }, 'none');
  const set = (p: number): void => {
    const i = Math.min(LABELS.length - 1, Math.floor(p * (LABELS.length - 1) + 1e-3));
    screen.update({ progress: p, label: LABELS[i] });
  };
  await Promise.all([
    ctx.assets.preload(ASSET_NAMES, (done, total) => set((MODELS_SHARE * done) / Math.max(1, total))),
    preloadCityFonts(),
  ]);
  set(0.9);
  await nextPaint();
  const save = ctx.saves.save;
  await ctx.backdrops.loadTitle(save.loadout, reducedMotion());
  set(1);
  await nextPaint();
}
