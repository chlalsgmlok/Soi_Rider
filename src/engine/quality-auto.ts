import type { QualityPreset } from '../core/types';
import { lowerPreset } from './quality';

export interface AutoQualityOptions {
  /** step down when the average fps of a window falls below this */
  minFps?: number;
  /** frames ignored right after begin() / a preset change (shader warm-up, streaming) */
  warmupSec?: number;
  /** length of one measurement window */
  windowSec?: number;
  /** stop adapting after this much sampled time (the preset is then locked for the session) */
  maxSampleSec?: number;
}

/**
 * 'auto' quality: samples real frame times during the first seconds of riding and steps the preset down
 * (high → medium → low) while the windowed average stays under `minFps`. Never steps up (no oscillation).
 * Pure logic — the Engine feeds it frame deltas and applies the returned preset.
 */
export class AutoQuality {
  preset: QualityPreset;
  private sampling = false;
  private locked = false;
  private warm = 0;
  private winTime = 0;
  private winFrames = 0;
  private total = 0;
  private readonly minFps: number;
  private readonly warmupSec: number;
  private readonly windowSec: number;
  private readonly maxSampleSec: number;

  constructor(start: QualityPreset, opts: AutoQualityOptions = {}) {
    this.preset = start;
    this.minFps = opts.minFps ?? 50;
    this.warmupSec = opts.warmupSec ?? 1.5;
    this.windowSec = opts.windowSec ?? 2.5;
    this.maxSampleSec = opts.maxSampleSec ?? 24;
  }

  get active(): boolean {
    return this.sampling && !this.locked;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** start (or restart) sampling — call when the player starts riding */
  begin(): void {
    if (this.locked) return;
    this.sampling = true;
    this.resetWindow();
  }

  /** pause sampling (menus, pause screen, cut-scenes) */
  end(): void {
    this.sampling = false;
  }

  /**
   * Feed one frame's real duration (s). Returns the new preset when a step-down happens, else null.
   */
  sample(frameDt: number): QualityPreset | null {
    if (!this.active || !(frameDt > 0)) return null;
    if (frameDt > 0.5) return null; // tab switch / breakpoint — not representative
    if (this.warm < this.warmupSec) {
      this.warm += frameDt;
      return null;
    }
    this.winTime += frameDt;
    this.winFrames++;
    this.total += frameDt;
    if (this.winTime < this.windowSec) return null;
    const fps = this.winFrames / this.winTime;
    this.winTime = 0;
    this.winFrames = 0;
    if (fps < this.minFps) {
      const next = lowerPreset(this.preset);
      if (next) {
        this.preset = next;
        this.resetWindow();
        if (!lowerPreset(next)) this.locked = true;
        return next;
      }
      this.locked = true;
    }
    if (this.total >= this.maxSampleSec) this.locked = true;
    return null;
  }

  private resetWindow(): void {
    this.warm = 0;
    this.winTime = 0;
    this.winFrames = 0;
  }
}
