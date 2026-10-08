import type { Scene } from 'three';
import type { Engine } from '../../engine/engine';

/**
 * A 3D backdrop the app shows behind a non-ride screen (title diorama, garage turntable, intro win stand).
 * Lifecycle: construct (assets preloaded) → `enter(engine)` when its screen shows (makes it the engine's scene,
 * snaps camera + post on the next update) → `update(dt)` once per rendered frame BEFORE `engine.render()` (animates,
 * moves the engine camera, sets PostFx params) → `exit()` when the screen leaves (drops listeners, keeps resources
 * for a quick return) → `dispose()` when the app no longer needs it.
 */
export interface BackdropScene {
  readonly scene: Scene;
  enter(engine: Engine): void;
  update(dt: number): void;
  exit(): void;
  dispose(): void;
}
