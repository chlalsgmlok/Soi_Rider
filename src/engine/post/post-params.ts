import { Color } from 'three';
import { damp } from '../../core/math2d';

export type ToneMap = 'neutral' | 'aces' | 'agx';

/**
 * Post-processing controls. Every field is smoothed internally toward the value passed to `PostFx.set`
 * (call `PostFx.snap()` to jump). Camera drives tiltShift/focusY/focusBand; Environment drives the grade
 * (exposure, warmth, saturation, contrast, tints, bloom); weather drives `wet`.
 */
export interface PostFxParams {
  /** 0..1 miniature (tilt-shift) blur strength — mockup 03 diorama = 1, POV = 0 */
  tiltShift: number;
  /** centre of the sharp band in screen UV (0 = bottom edge, 0.5 = middle, 1 = top edge) */
  focusY: number;
  /** half-height of the fully sharp band, fraction of the screen height (0.04..0.5) */
  focusBand: number;
  /** extra screen fraction over which the blur ramps to full */
  focusFeather: number;
  /** bloom intensity (0 = off) */
  bloom: number;
  /** display-referred luminance above which pixels bloom (lamps, neon, headlights, sun glints) */
  bloomThreshold: number;
  /** 0..1 edge darkening */
  vignette: number;
  /** 1 = neutral */
  saturation: number;
  /** white balance: −1 cool … 0 neutral … +1 warm */
  warmth: number;
  /** linear exposure multiplier applied before tone mapping */
  exposure: number;
  /** 1 = neutral; > 1 punchier */
  contrast: number;
  /** additive colour lifted into the shadows (display-linear hex, e.g. lavender at sunset) */
  shadowTint: string;
  /** multiplicative colour for the highlights (e.g. peach/gold) — '#ffffff' = neutral */
  highlightTint: string;
  /** 0..1 strength of shadowTint */
  shadowTintAmount: number;
  /** 0..1 lens raindrops / streaks (rain in POV) */
  wet: number;
}

export const DEFAULT_POST: Readonly<PostFxParams> = {
  tiltShift: 1,
  focusY: 0.45,
  focusBand: 0.14,
  focusFeather: 0.34,
  bloom: 0.9,
  bloomThreshold: 0.9,
  vignette: 0.32,
  saturation: 1.12,
  warmth: 0.25,
  exposure: 1,
  contrast: 1.06,
  shadowTint: '#3a2f6b',
  highlightTint: '#fff1dc',
  shadowTintAmount: 0.35,
  wet: 0,
};

type NumKey = { [K in keyof PostFxParams]: PostFxParams[K] extends number ? K : never }[keyof PostFxParams];
type ColorKey = 'shadowTint' | 'highlightTint';

const NUM_KEYS: readonly NumKey[] = [
  'tiltShift', 'focusY', 'focusBand', 'focusFeather', 'bloom', 'bloomThreshold', 'vignette', 'saturation',
  'warmth', 'exposure', 'contrast', 'shadowTintAmount', 'wet',
];
const COLOR_KEYS: readonly ColorKey[] = ['shadowTint', 'highlightTint'];

/** Current/target pair with exponential smoothing; colours are lerped in linear space. */
export class SmoothedPostParams {
  readonly target: PostFxParams = { ...DEFAULT_POST };
  readonly current: PostFxParams = { ...DEFAULT_POST };
  readonly colors: Record<ColorKey, Color> = {
    shadowTint: new Color(DEFAULT_POST.shadowTint),
    highlightTint: new Color(DEFAULT_POST.highlightTint),
  };
  private readonly targetColors: Record<ColorKey, Color> = {
    shadowTint: new Color(DEFAULT_POST.shadowTint),
    highlightTint: new Color(DEFAULT_POST.highlightTint),
  };

  /** per-second smoothing rates (higher = snappier) */
  rate = 5;
  /** the focus band follows the camera rig closely */
  focusRate = 10;

  set(p: Partial<PostFxParams>): void {
    Object.assign(this.target, p);
    for (const k of COLOR_KEYS) if (p[k] !== undefined) this.targetColors[k].set(p[k]);
  }

  snap(): void {
    for (const k of NUM_KEYS) this.current[k] = this.target[k];
    for (const k of COLOR_KEYS) {
      this.colors[k].copy(this.targetColors[k]);
      this.current[k] = this.target[k];
    }
  }

  update(dt: number): void {
    const a = damp(this.rate, dt);
    const f = damp(this.focusRate, dt);
    for (const k of NUM_KEYS) {
      const t = k === 'focusY' || k === 'focusBand' || k === 'tiltShift' ? f : a;
      this.current[k] += (this.target[k] - this.current[k]) * t;
    }
    for (const k of COLOR_KEYS) {
      this.colors[k].lerp(this.targetColors[k], a);
      this.current[k] = this.target[k];
    }
  }
}
