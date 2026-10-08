import { makeOBB } from '../../../core/math2d';
import { Rng } from '../../../core/rng';
import type { DistrictId, Loadout, TimeOfDay } from '../../../core/types';
import type { Assets } from '../../../engine/assets/assets';
import type { Engine } from '../../../engine/engine';
import { Environment } from '../../../engine/env/environment';
import { CameraProbe, capsFor, TrafficSystem, TrafficView, trafficAssetNames } from '../../../traffic';
import {
  buildCityView, cityAssetNames, createCityQuery, DISTRICT_IDS, generateCity, preloadCityFonts,
} from '../../../world';
import { IntroScene } from '../intro/intro-scene';
import type { StreetLifeParts } from '../shared/street-life';
import { generateOffers } from '../../../logic';
import { type Harness, param, pick } from './harness';
import { showIntroUi } from './ui-overlay';

const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];

/**
 * intro: plays the session's part (city, Environment, traffic) around an IntroScene.
 * ?seed= &district= &tod= &traffic=0 &swoop=<ms> (auto-accept) &reduced=1 &ui=1 (the gram phone; accepting swoops)
 * keys Enter swoop to ride
 */
export async function introHarness(engine: Engine, assets: Assets, qs: URLSearchParams, loadout: Loadout,
  progress: (text: string) => void): Promise<Harness> {
  const seed = param(qs, 'seed', 7);
  const district = pick<DistrictId>(qs, 'district', DISTRICT_IDS, 'sukhumvit');
  const tod = pick(qs, 'tod', TODS, 'sunset');
  const withTraffic = qs.get('traffic') !== '0';
  const data = generateCity(seed, district);
  const query = createCityQuery(data);
  const names = [...cityAssetNames(data), ...IntroScene.assetNames(), ...(withTraffic ? trafficAssetNames() : [])];
  await Promise.all([preloadCityFonts(), assets.preload(names, (d, t, n) => progress(`loading ${d}/${t} · ${n}`))]);
  const city = buildCityView(data, { quality: engine.quality, rng: new Rng(seed).fork('cityview'), assets });
  const env = new Environment(engine.renderer, engine.quality, tod);
  env.setWeather({ overcast: 0, rain: 0, haze: 0.08 }, 0);
  let traffic: StreetLifeParts | undefined;
  if (withTraffic) {
    const system = new TrafficSystem(query, new Rng(seed), {
      intensity: 'rush', bus: null, conditions: { timeOfDay: tod, rain: 0 }, caps: capsFor(engine.quality, 'rush'),
    });
    const probe = new CameraProbe(query);
    system.setViewProbe(probe);
    const s = data.spawn;
    system.warmup({ pos: s.pos, heading: s.heading, speed: 0, obb: makeOBB(s.pos.x, s.pos.z, 0.7, 1.9, s.heading) }, 8, 'rush');
    traffic = { system, view: new TrafficView(assets, query, { bus: null }), intensity: 'rush', probe };
  }
  const intro = new IntroScene(engine, assets, { city, query, env, loadout, traffic, reducedMotion: qs.get('reduced') === '1' });
  let state = 'phone';
  const swoop = (): void => {
    if (state !== 'phone') return;
    state = 'swooping';
    const t0 = performance.now();
    void intro.swoopToRide().then(() => (state = `ride (${Math.round(performance.now() - t0)} ms)`));
  };
  if (qs.has('swoop')) setTimeout(swoop, param(qs, 'swoop', 0));
  if (qs.get('ui') === '1') showIntroUi(data, generateOffers(data, new Rng(seed).fork('jobs'), 'rush', 3), tod, swoop);
  return {
    scene: intro,
    key(code) {
      // with the phone up, Enter belongs to the gram app (its accept calls swoop after the phone shrinks)
      if (code !== 'Enter' || qs.get('ui') === '1') return false;
      swoop();
      return true;
    },
    info: () => `intro · ${district} ${seed} · ${tod} · ${state} · stand ${intro.site.stand ? '✓' : '✗'} cart ${intro.site.cart ? '✓' : '✗'}`,
    stats: () => ({ state, stand: !!intro.site.stand, cart: !!intro.site.cart, lek: intro.site.lek }),
  };
}
