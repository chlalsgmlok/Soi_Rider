import type { CameraPost } from '../../../camera';
import type { Engine } from '../../../engine/engine';
import type { EnvGrade } from '../../../engine/env/environment';
import type { PostFxParams } from '../../../engine/post/post-params';

/** a backdrop's art direction on top of the Environment grade: multipliers (×) and offsets (+) */
export interface GradeTweak {
  /** × */
  saturation?: number;
  /** + */
  contrast?: number;
  /** + */
  vignette?: number;
  /** × */
  exposure?: number;
  /** × */
  bloom?: number;
  /** × — raise to keep small speculars from blooming, so only lamps and neon glow */
  bloomThreshold?: number;
  /** + */
  warmth?: number;
}

/**
 * Hands PostFx one reused params object per frame: the Environment's grade for the current light, the camera's
 * tilt-shift band and the backdrop's tweak. The first frame after `enter` snaps instead of easing in.
 */
export class BackdropPost {
  private readonly p: Partial<PostFxParams> = {};
  private snapNext = true;

  constructor(private readonly tweak: GradeTweak = {}) {}

  /** jump (no easing) on the next apply — scene cuts */
  snap(): void {
    this.snapNext = true;
  }

  apply(engine: Engine, grade: EnvGrade, cam: CameraPost): void {
    const p = Object.assign(this.p, grade, cam);
    const t = this.tweak;
    p.saturation = grade.saturation * (t.saturation ?? 1);
    p.contrast = grade.contrast + (t.contrast ?? 0);
    p.vignette = grade.vignette + (t.vignette ?? 0);
    p.exposure = grade.exposure * (t.exposure ?? 1);
    p.bloom = grade.bloom * (t.bloom ?? 1);
    p.bloomThreshold = grade.bloomThreshold * (t.bloomThreshold ?? 1);
    p.warmth = grade.warmth + (t.warmth ?? 0);
    engine.post.set(p);
    if (this.snapNext) engine.post.snap();
    this.snapNext = false;
  }
}
