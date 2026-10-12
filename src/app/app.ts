import { AudioEngine, bindAudio, type MusicTrack } from '../audio';
import { bus } from '../core/events';
import type { CityData, RunConfig, RunResult, Settings } from '../core/types';
import { Assets, Engine, GameLoop, Input } from '../engine';
import { Leaderboard } from '../online';
import { reducedMotion, UI } from '../ui';
import '../ui/screens/boot';
import '../ui/screens/garage';
import '../ui/screens/intro';
import '../ui/screens/pause';
import '../ui/screens/ranking';
import '../ui/screens/results';
import '../ui/screens/settings';
import '../ui/screens/setup';
import '../ui/screens/shop';
import '../ui/screens/title';
import type { AppCtx, AppNav, AppState, Stage } from './app-context';
import { Backdrops } from './backdrops';
import { runBoot } from './flows/boot-flow';
import { showGarage, showShop } from './flows/garage-flow';
import { showIntro } from './flows/intro-flow';
import { showRanking } from './flows/ranking-flow';
import { openPause } from './flows/pause-flow';
import { openSettings } from './flows/settings-flow';
import { showSetup } from './flows/setup-flow';
import { startAt } from './flows/skip-flow';
import { showTitle } from './flows/title-flow';
import { startFuelClock } from './fuel-clock';
import { GameProbe } from './game-probe';
import { type AppParams, readParams } from './params';
import { SaveKeeper } from './save-keeper';
import type { BackdropScene } from './scenes';
import { GameSession } from './session/game-session';
import { applySettings, type LiveTargets } from './settings-live';
import { StoryBeats } from './story/story-beats';

/**
 * SOI RIDER: the one place that owns the engine, UI, audio, input, assets, save and the game loop, and walks the
 * states BOOT → TITLE → (GARAGE ⇄ SHOP) → SETUP → INTRO → PLAY ⇄ PAUSE → RESULTS (src/app/flows has one module per
 * screen). Each rendered frame draws the current Stage; the fixed 60 Hz step drives the run (GameSession).
 */
export class App implements AppCtx, AppNav {
  readonly params: AppParams = readParams(location.search);
  readonly saves = new SaveKeeper();
  readonly leaderboard = new Leaderboard();
  readonly bus = bus;
  readonly assets = new Assets();
  readonly audio: AudioEngine;
  readonly engine: Engine;
  readonly ui: UI;
  readonly input = new Input({ touch: 'off' });
  readonly backdrops: Backdrops;
  readonly story: StoryBeats;
  readonly nav: AppNav = this;
  state: AppState = 'boot';
  session: GameSession | null = null;
  lastResult: RunResult | null = null;
  private stage: Stage | null = null;
  private readonly loop: GameLoop;
  private readonly probe: GameProbe;

  /** builds the app on the page's canvas + UI root, boots, then shows the title (or the ?skip= state) */
  static async start(canvas: HTMLCanvasElement, uiRoot: HTMLElement): Promise<App> {
    const app = new App(canvas, uiRoot);
    await Promise.all([runBoot(app), app.story.load()]);
    startAt(app, app.params.skip);
    return app;
  }

  private constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    const settings = this.saves.save.settings;
    this.engine = new Engine(canvas, { quality: this.params.quality ?? settings.quality });
    this.ui = new UI(uiRoot, { bus });
    this.audio = new AudioEngine({ volumes: { master: settings.master, music: settings.music, sfx: settings.sfx } });
    this.audio.autoUnlock();
    bindAudio(this.audio, bus);
    this.backdrops = new Backdrops(this.engine, this.assets);
    this.story = new StoryBeats(this.ui.root);
    applySettings(this.liveTargets(), settings, null);
    this.probe = new GameProbe(this);
    this.loop = new GameLoop({ step: (dt) => this.session?.step(dt), render: (_a, dt) => this.frame(dt) });
    this.loop.start();
    startFuelClock(this.saves, this.ui);
    // leaving the tab mid-ride opens the pause sheet instead of letting the run go on blind
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play' && this.session) openPause(this, this.session);
    });
  }

  title(): void {
    showTitle(this);
  }

  garage(): void {
    showGarage(this).catch((err: unknown) => console.error('[app] the garage failed to open', err));
  }

  shop(back: () => void): void {
    showShop(this, back);
  }

  ranking(back: () => void): void {
    showRanking(this, back);
  }

  setup(): void {
    showSetup(this);
  }

  intro(config: RunConfig): void {
    showIntro(this, config);
  }

  settings(onClose?: () => void): void {
    openSettings(this, onClose);
  }

  showBackdrop(scene: BackdropScene, stage?: Stage): void {
    this.backdrops.show(scene);
    this.stage = stage ?? { frame: (dt) => scene.update(dt) };
  }

  setStage(stage: Stage | null): void {
    this.stage = stage;
  }

  startSession(config: RunConfig, data: CityData): GameSession {
    this.endSession();
    const s = this.saves.save.settings;
    this.session = new GameSession({
      engine: this.engine, assets: this.assets, audio: this.audio, input: this.input, bus, bot: this.params.bot,
      camera: s.camera, reducedMotion: reducedMotion(),
    }, config, data);
    return this.session;
  }

  endSession(): void {
    const s = this.session;
    if (!s) return;
    this.session = null;
    this.stage = null;
    this.loop.resume();
    this.loop.timeScale = 1;
    this.input.setTouchControls(false);
    this.engine.endAutoQuality();
    s.dispose();
  }

  music(track: MusicTrack | null): void {
    this.audio.music(track);
  }

  applySettings(next: Settings): void {
    const prev = this.saves.save.settings;
    this.saves.settings(next);
    applySettings(this.liveTargets(), next, prev);
  }

  pauseLoop(on: boolean): void {
    if (on) this.loop.pause();
    else this.loop.resume();
  }

  private liveTargets(): LiveTargets {
    return {
      engine: this.engine, audio: this.audio, ui: this.ui, input: this.input, backdrops: this.backdrops, session: this.session,
      riding: this.state === 'play', qualityOverride: this.params.quality,
    };
  }

  private frame(dt: number): void {
    const stage = this.stage;
    if (stage) {
      stage.frame(dt);
      this.loop.timeScale = this.session?.timeScale ?? 1;
      this.engine.render();
      stage.after?.();
    }
    this.probe.tick();
  }
}
