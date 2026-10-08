import { CAMERA } from '../core/config/camera';
import { smoothstep } from '../core/math2d';

/** leave squeeze only once the gap opens past this (m) or the speed passes this (km/h) — hysteresis */
export const EXIT_GAP = 0.62;
export const EXIT_KMH = 26;

/**
 * AUTO camera: diorama ⇄ squeeze. Enters when a side gap < 0.45 m below 22 km/h (blend in 0.6 s); after the
 * squeeze ends it holds 1.2 s, then blends out over 1.0 s (docs/GAME_DESIGN.md §12). Hysteresis keeps a gap
 * hovering around the threshold from flickering the camera.
 */
export class AutoSqueeze {
  /** 0 diorama … 1 squeeze (linear) */
  level = 0;
  private hold = 0;
  private engaged = false;

  /** eased blend weight */
  get weight(): number {
    return smoothstep(0, 1, this.level);
  }

  get active(): boolean {
    return this.engaged;
  }

  reset(level = 0): void {
    this.level = level;
    this.engaged = level > 0.5;
    this.hold = 0;
  }

  update(dt: number, minGap: number, speedKmh: number, fallen: boolean): number {
    const c = CAMERA.squeeze;
    const enter = !fallen && minGap < c.gapThreshold && speedKmh < c.maxSpeedKmh;
    const exit = fallen || minGap > EXIT_GAP || speedKmh > EXIT_KMH;
    if (enter) {
      this.engaged = true;
      this.hold = c.hold;
    } else if (this.engaged && exit) {
      this.hold -= dt;
      if (this.hold <= 0) this.engaged = false;
    }
    if (this.engaged) this.level = Math.min(1, this.level + dt / c.blendIn);
    else this.level = Math.max(0, this.level - dt / c.blendOut);
    return this.weight;
  }
}
