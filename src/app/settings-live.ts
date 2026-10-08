import type { AudioEngine } from '../audio';
import type { QualityPreset, Settings } from '../core/types';
import type { Engine, Input } from '../engine';
import { reducedMotion, type UI } from '../ui';
import type { Backdrops } from './backdrops';
import type { GameSession } from './session/game-session';

export interface LiveTargets {
  engine: Engine;
  audio: AudioEngine;
  ui: UI;
  input: Input;
  backdrops: Backdrops;
  session: GameSession | null;
  /** riding right now (touch controls only show then) */
  riding: boolean;
  /** ?q= pins the preset over Settings.quality */
  qualityOverride: QualityPreset | null;
}

/**
 * Applies Settings live: volumes, quality preset (unless pinned by ?q=), reduced motion (UI, backdrops, camera
 * shake), mini-map, the ride camera mode and touch controls. `prev` = null at boot (the engine already got its preset).
 */
export function applySettings(t: LiveTargets, next: Settings, prev: Settings | null): void {
  t.audio.setVolumes(next.master, next.music, next.sfx);
  if (prev && !t.qualityOverride && prev.quality !== next.quality) t.engine.setQuality(next.quality);
  t.ui.setReducedMotion(next.reducedMotion ? true : null);
  const reduced = reducedMotion();
  t.backdrops.setReducedMotion(reduced);
  t.ui.hud.configure({ minimap: next.minimap });
  const s = t.session;
  if (s) {
    s.ride.cam.reducedMotion = reduced;
    if (prev && prev.camera !== next.camera) s.ride.setCameraMode(next.camera);
  }
  if (t.riding) t.input.setTouchControls(next.touch);
}
