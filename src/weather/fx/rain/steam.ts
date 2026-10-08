import { smoothstep } from '../../../core/math2d';
import type { Rng } from '../../../core/rng';
import type { FxFrame } from '../fx-frame';
import { createSpec } from '../particles/particle-pool';
import type { ParticleLayer } from '../particles/particle-layer';

const RADIUS = 12;
/** steam only rises off the asphalt (road level), not the raised pavements */
const ROAD_TOP = 0.03;
const spec = createSpec();

/**
 * After the rain, when the sun hits the soaked asphalt: faint wisps of steam curl up off the road around the rider
 * and drift with the wind. Strength = wetness × sunlight × no rain.
 */
export class Steam {
  constructor(private readonly mist: ParticleLayer, private readonly rng: Rng) {}

  /** `sunlit` 0..1: daylight × how much sun gets through the clouds */
  update(f: FxFrame, sunlit: number): void {
    const s = f.state;
    const k = smoothstep(0.2, 0.7, s.wetness) * (1 - smoothstep(0.01, 0.08, s.rain)) * sunlit;
    const n = Math.floor(24 * k * f.dt + this.rng.next());
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * RADIUS;
      spec.x = f.focus.x + f.ahead.x * 4 + Math.cos(a) * d;
      spec.z = f.focus.z + f.ahead.z * 4 + Math.sin(a) * d;
      const ground = f.groundHeight(spec.x, spec.z);
      if (ground > ROAD_TOP) continue;
      spec.floor = ground + 0.04;
      spec.y = spec.floor + 0.06;
      spec.vx = rng.range(-0.15, 0.15);
      spec.vz = rng.range(-0.15, 0.15);
      spec.vy = rng.range(0.3, 0.6);
      spec.life = rng.range(2.6, 4.2);
      spec.size0 = rng.range(0.25, 0.45);
      spec.size1 = rng.range(1.2, 1.8);
      spec.alpha = 0.6 * (0.5 + 0.5 * k);
      spec.r = spec.g = spec.b = 0.97;
      spec.drag = 0.6;
      spec.gravity = 0.05;
      this.mist.pool.emit(spec);
    }
  }
}
