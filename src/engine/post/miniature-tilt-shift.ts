import type { WebGLRenderer, WebGLRenderTarget } from 'three';
import { BlendFunction, KernelSize, TiltShiftEffect } from 'postprocessing';
import type { BlurKernel } from '../quality';

const KERNEL: Record<BlurKernel, KernelSize> = {
  small: KernelSize.MEDIUM,
  medium: KernelSize.LARGE,
  large: KernelSize.VERY_LARGE,
};

/**
 * Tilt-shift "miniature" blur with a screen-space focus band. Strength scales the blend opacity; at ~0 the
 * Kawase blur pass is skipped entirely (POV costs nothing).
 */
export class MiniatureTiltShift extends TiltShiftEffect {
  constructor(kernel: BlurKernel) {
    super({
      blendFunction: BlendFunction.NORMAL,
      kernelSize: KERNEL[kernel],
      resolutionScale: kernel === 'small' ? 0.4 : 0.5,
      focusArea: 0.5,
      feather: 0.35,
    });
  }

  /**
   * @param strength 0..1
   * @param focusY sharp-band centre in screen UV (0 bottom … 1 top)
   * @param band half-height of the sharp band (screen fraction)
   * @param feather screen fraction over which blur ramps to full
   */
  configure(strength: number, focusY: number, band: number, feather: number): void {
    this.blendMode.opacity.value = Math.max(0, Math.min(1, strength));
    // TiltShiftEffect works in a −1..1 vertical space: double every screen fraction
    const offset = (focusY - 0.5) * 2;
    const area = Math.max(0.02, (band + feather) * 2);
    const f = Math.min(area - 0.01, Math.max(0.01, feather * 2));
    if (Math.abs(this.offset - offset) > 1e-4) this.offset = offset;
    if (Math.abs(this.focusArea - area) > 1e-4) this.focusArea = area;
    if (Math.abs(this.feather - f) > 1e-4) this.feather = f;
  }

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, deltaTime?: number): void {
    if (this.blendMode.opacity.value < 0.01) return;
    super.update(renderer, inputBuffer, deltaTime);
  }
}
