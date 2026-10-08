import type { AudioEngine, MusicTrack } from '../audio';
import type { EventBus } from '../core/events';
import type { CityData, RunConfig, RunResult, Settings } from '../core/types';
import type { Assets, Engine, Input } from '../engine';
import type { UI } from '../ui';
import type { Backdrops } from './backdrops';
import type { AppParams } from './params';
import type { SaveKeeper } from './save-keeper';
import type { BackdropScene } from './scenes';
import type { GameSession } from './session/game-session';
import type { StoryBeats } from './story/story-beats';

/** BOOT → TITLE → (GARAGE ⇄ SHOP) → SETUP → INTRO → PLAY ⇄ PAUSE → RESULTS (docs/GAME_DESIGN.md §2) */
export type AppState = 'boot' | 'title' | 'garage' | 'shop' | 'setup' | 'intro' | 'play' | 'pause' | 'results';

/** whatever is on screen this frame: a menu backdrop, the intro at the win stand, the run */
export interface Stage {
  /** before engine.render(): animate, move the camera, set the post params */
  frame(dt: number): void;
  /** after engine.render() (the HUD snapshot) */
  after?(): void;
}

/** screen-to-screen navigation (the App implements it; flows only call it) */
export interface AppNav {
  title(): void;
  garage(): void;
  /** the shop returns through `back` (title or garage) */
  shop(back: () => void): void;
  setup(): void;
  /** the run is configured: build the city, show the gram phone at the win stand */
  intro(config: RunConfig): void;
  /** settings overlay (title or pause) */
  settings(onClose?: () => void): void;
}

/** What every flow (src/app/flows) works with. */
export interface AppCtx {
  readonly engine: Engine;
  readonly ui: UI;
  readonly audio: AudioEngine;
  readonly input: Input;
  readonly assets: Assets;
  readonly bus: EventBus;
  readonly params: AppParams;
  readonly saves: SaveKeeper;
  readonly backdrops: Backdrops;
  /** story comic panels (first call, raincoat, mask) — inert until the story art exists */
  readonly story: StoryBeats;
  readonly nav: AppNav;
  /** current state (window.__game.state) */
  state: AppState;
  readonly session: GameSession | null;
  /** the last receipt (window.__game.result) */
  lastResult: RunResult | null;
  /** a 3D backdrop takes the screen (flows end a finished run first); `stage` overrides its default frame */
  showBackdrop(scene: BackdropScene, stage?: Stage): void;
  setStage(stage: Stage | null): void;
  /** a new run for `config` in `data` (the previous one is disposed) */
  startSession(config: RunConfig, data: CityData): GameSession;
  /** dispose the run (if any) */
  endSession(): void;
  music(track: MusicTrack | null): void;
  /** Settings changed (settings screen): persist + apply live */
  applySettings(next: Settings): void;
  /** freeze / resume the fixed-step simulation (PAUSE) */
  pauseLoop(on: boolean): void;
}
