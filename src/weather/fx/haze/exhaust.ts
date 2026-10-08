import type { Rng } from '../../../core/rng';
import type { Vec2 } from '../../../core/types';
import { createSpec } from '../particles/particle-pool';
import type { ParticleLayer } from '../particles/particle-layer';

const spec = createSpec();

/**
 * Diesel soot from buses, songthaews and tuk-tuks pulling away (TrafficSystem.onExhaust → emitExhaust): a few dark
 * puffs blown back from the tailpipe that billow, rise and drift with the wind. Thicker and longer-lived in smog.
 */
export class Exhaust {
  /** current smog level 0..1 (set by HazeFx every frame) */
  smog = 0;

  constructor(private readonly smoke: ParticleLayer, private readonly rng: Rng, private readonly groundHeight: (x: number, z: number) => number) {}

  /** `heading` = direction the smoke leaves along (vehicle heading + π), `strength` 0..1 */
  emit(pos: Vec2, heading: number, strength = 1): void {
    const rng = this.rng;
    const s = Math.min(1, Math.max(0, strength));
    const thick = 0.55 + 0.45 * this.smog;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const ground = this.groundHeight(pos.x, pos.z);
    const n = 2 + Math.round(3 * s * thick);
    for (let i = 0; i < n; i++) {
      const out = rng.range(1.1, 2.6) * (0.6 + 0.4 * s);
      const lateral = rng.range(-0.35, 0.35);
      spec.x = pos.x + fx * rng.range(0, 0.25);
      spec.z = pos.z + fz * rng.range(0, 0.25);
      spec.floor = ground + 0.45;
      spec.y = ground + rng.range(0.5, 0.7);
      spec.vx = fx * out - fz * lateral;
      spec.vz = fz * out + fx * lateral;
      spec.vy = rng.range(0.35, 0.8);
      spec.life = rng.range(2.2, 3.6) * (0.8 + 0.5 * this.smog);
      spec.size0 = rng.range(0.3, 0.45);
      spec.size1 = rng.range(2.4, 3.6) * (0.8 + 0.4 * s);
      spec.alpha = 0.38 * (0.45 + 0.55 * s) * thick;
      const grey = rng.range(0.13, 0.2);
      spec.r = grey * 1.05;
      spec.g = grey;
      spec.b = grey * 0.92;
      spec.drag = 1.1;
      spec.gravity = 0.45;
      this.smoke.pool.emit(spec);
    }
  }
}
