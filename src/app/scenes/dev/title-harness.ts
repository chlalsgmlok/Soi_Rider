import type { Loadout, TimeOfDay, TrafficIntensity } from '../../../core/types';
import type { Assets } from '../../../engine/assets/assets';
import type { Engine } from '../../../engine/engine';
import { DISTRICT_IDS } from '../../../world';
import { TITLE_SHOT } from '../title/title-shot';
import { TitleScene } from '../title/title-scene';
import { TITLE_CITY } from '../title/title-site';
import { cycle, type Harness, param, pick } from './harness';
import { demoSave, showTitleUi } from './ui-overlay';

const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const INTENSITIES: readonly TrafficIntensity[] = ['light', 'rush', 'gridlock'];

/**
 * title: ?tod= &intensity= &warm=<s> &reduced=1 · explore: &seed= &district= &rank= · art direction: any TitleShot
 * field as a number (&radius=16&height=12.5&yaw=0.42…) · &ui=1|gate (the real title screen on top)
 * keys T time of day, M reduced motion
 */
export async function titleHarness(engine: Engine, assets: Assets, qs: URLSearchParams, loadout: Loadout,
  progress: (text: string) => void): Promise<Harness> {
  let tod = pick(qs, 'tod', TODS, 'sunset');
  let reduced = qs.get('reduced') === '1';
  const t0 = performance.now();
  const title = await TitleScene.create(engine, assets, {
    loadout, timeOfDay: tod, intensity: pick(qs, 'intensity', INTENSITIES, 'rush'), warmup: param(qs, 'warm', 12),
    reducedMotion: reduced,
    showcase: qs.has('seed') || qs.has('district') || qs.has('rank') ? {
      seed: param(qs, 'seed', TITLE_CITY.seed), district: pick(qs, 'district', DISTRICT_IDS, TITLE_CITY.district),
      rank: param(qs, 'rank', 0),
    } : undefined,
    shot: Object.fromEntries(Object.keys(TITLE_SHOT).filter((k) => qs.has(k)).map((k) => [k, Number(qs.get(k))])),
  }, (d, t, n) => progress(`loading ${d}/${t} · ${n}`));
  const buildMs = Math.round(performance.now() - t0);
  if (qs.has('ui')) showTitleUi(demoSave(loadout), qs.get('ui') === 'gate');
  return {
    scene: title,
    key(code) {
      if (code === 'KeyT') title.setTimeOfDay((tod = cycle(TODS, tod)));
      else if (code === 'KeyM') title.reducedMotion = reduced = !reduced;
      else return false;
      return true;
    },
    info: () => `title · ${tod}${reduced ? ' · reduced' : ''} · node ${title.site.node} · build ${buildMs} ms`,
    stats: () => ({ tod, buildMs, site: title.site, ...title.stats() }),
  };
}
