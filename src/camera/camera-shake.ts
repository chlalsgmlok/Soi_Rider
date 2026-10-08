import type { Vector3 } from 'three';

/**
 * Trauma-style camera shake: `add(strength, seconds)` raises trauma (0..1) which decays over the duration;
 * the offset scales with trauma² and uses layered sines (deterministic, no allocation).
 */
export class CameraShake {
  private trauma = 0;
  private decay = 1;
  private t = 0;
  /** reduced-motion setting: no shake at all */
  enabled = true;

  add(strength: number, seconds: number): void {
    const s = Math.min(1, Math.max(0, strength));
    if (s >= this.trauma) this.decay = s / Math.max(0.05, seconds);
    this.trauma = Math.max(this.trauma, s);
  }

  reset(): void {
    this.trauma = 0;
  }

  /** advance and write the positional offset (m) into `out`; returns the roll offset (rad) */
  update(dt: number, out: Vector3): number {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    if (!this.enabled || this.trauma <= 0) {
      out.set(0, 0, 0);
      return 0;
    }
    const a = this.trauma * this.trauma;
    const t = this.t;
    out.set(
      a * 0.22 * (Math.sin(t * 37.1) * 0.6 + Math.sin(t * 61.7 + 1.3) * 0.4),
      a * 0.16 * (Math.sin(t * 43.3 + 2.1) * 0.6 + Math.sin(t * 71.9) * 0.4),
      a * 0.12 * Math.sin(t * 29.3 + 0.7),
    );
    return a * 0.05 * Math.sin(t * 33.7 + 0.4);
  }
}
