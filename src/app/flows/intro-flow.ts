import { ambienceFor } from '../../audio';
import { Rng } from '../../core/rng';
import type { CityData, JobOffer, RunConfig } from '../../core/types';
import { DISTRICT_LABEL, generateOffers } from '../../logic';
import { reducedMotion } from '../../ui';
import { generateCity } from '../../world';
import type { AppCtx, Stage } from '../app-context';
import { IntroScene } from '../scenes';
import type { GameSession } from '../session/game-session';
import { type FinishRun, startPlay } from './play-flow';

/** seconds the gram app gives to pick a call (it auto-accepts the first card at zero) */
const CHOOSE_SEC = 20;
/** ?bot=1: the countdown runs out quickly, so the first call is auto-accepted like a hesitant player's */
const BOT_CHOOSE_SEC = 3;

interface RunCity {
  data: CityData;
  offers: JobOffer[];
}

const cityFor = (config: RunConfig): RunCity => {
  const data = generateCity(config.seed, config.district);
  return { data, offers: generateOffers(data, new Rng(config.seed).fork('offers'), config.intensity, config.tripNumber) };
};

/** the win stand in the run's own city: the session's rig, camera rig and traffic, posed by an IntroScene */
function standScene(ctx: AppCtx, session: GameSession, config: RunConfig): IntroScene {
  const w = session.world;
  const intro = new IntroScene(ctx.engine, ctx.assets, {
    city: w.city, query: w.query, env: w.env, loadout: config.loadout, scene: w.scene, rig: session.ride.rig,
    cameraRig: session.ride.cam, reducedMotion: reducedMotion(),
    traffic: { system: w.traffic, view: w.trafficView, intensity: config.intensity, probe: w.probe },
  });
  const stage: Stage = {
    frame(dt) {
      session.introFrame(dt);
      intro.update(dt);
    },
  };
  ctx.showBackdrop(intro, stage);
  ctx.audio.ambience(ambienceFor(config.intensity, config.timeOfDay, config.weather.base), 2.5);
  return intro;
}

/** accepted: swoop down onto the ride framing (or cut, for ?skip=play), then the crosswalk wipe reveals the HUD */
async function rideOff(ctx: AppCtx, session: GameSession, intro: IntroScene, job: JobOffer, cut: boolean,
  riding?: (finish: FinishRun) => void): Promise<void> {
  await (cut ? intro.skipToRide() : intro.swoopToRide());
  if (ctx.session !== session) return;
  ctx.ui.show('hud', {}, cut ? 'none' : 'wipe', {
    onCovered: () => {
      const sp = intro.site.spawn;
      ctx.backdrops.hide();
      ctx.story.hide();
      intro.dispose();
      const finish = startPlay(ctx, session, job, { pos: sp.pos, heading: sp.heading });
      riding?.(finish);
    },
  });
}

/**
 * INTRO: the run's city is generated and built under the wipe; the rider idles at the win stand beside Aunt Lek's
 * khao man gai cart while the gram phone offers three calls. Accepting swoops the camera onto the ride.
 */
export function showIntro(ctx: AppCtx, config: RunConfig): void {
  const { data, offers } = cityFor(config);
  let ready: { session: GameSession; intro: IntroScene } | null = null;
  let accepted = false;
  ctx.ui.show('intro', {
    tripNumber: config.tripNumber,
    nickname: config.loadout.nickname,
    districtLabel: DISTRICT_LABEL[config.district],
    timeOfDay: config.timeOfDay,
    weather: config.weather,
    offers,
    poiName: (id) => data.pois.find((p) => p.id === id)?.name ?? '',
    secondsToChoose: ctx.params.bot ? BOT_CHOOSE_SEC : CHOOSE_SEC,
    onAccept: (offerId) => {
      if (accepted || !ready) return;
      accepted = true;
      ctx.story.hide();
      void rideOff(ctx, ready.session, ready.intro, offers.find((o) => o.id === offerId) ?? offers[0], false);
    },
  }, 'wipe', {
    onCovered: () => {
      const session = ctx.startSession(config, data);
      ready = { session, intro: standScene(ctx, session, config) };
      ctx.state = 'intro';
      ctx.story.show('story_first_call', 'intro');
      ctx.music('title');
    },
  });
}

/** ?skip=play|results: no phone — the session is built and the chosen call starts straight from the win stand */
export function quickRide(ctx: AppCtx, config: RunConfig, riding?: (finish: FinishRun, session: GameSession) => void): void {
  const { data, offers } = cityFor(config);
  const session = ctx.startSession(config, data);
  const intro = standScene(ctx, session, config);
  ctx.state = 'intro';
  const job = offers[Math.min(ctx.params.job, offers.length - 1)];
  void rideOff(ctx, session, intro, job, true, riding && ((finish) => riding(finish, session)));
}
