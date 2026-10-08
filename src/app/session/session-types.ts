import type { AudioEngine } from '../../audio';
import type { EventBus } from '../../core/events';
import type { CameraMode } from '../../core/types';
import type { Assets, Engine, Input } from '../../engine';

/** what a GameSession borrows from the app (it owns everything else it builds) */
export interface SessionDeps {
  engine: Engine;
  assets: Assets;
  audio: AudioEngine;
  input: Input;
  bus: EventBus;
  /** ?bot=1 autopilot */
  bot: boolean;
  /** Settings.camera: the ride camera's starting mode */
  camera: CameraMode;
  reducedMotion: boolean;
}

/** intro = the win stand (IntroScene drives the frames), ride = PLAY, outro = parked behind the RESULTS receipt */
export type SessionMode = 'intro' | 'ride' | 'outro';
export type RunEnd = 'complete' | 'failed';
