import { smoothstep } from '../../../core/math2d';
import type { Rng } from '../../../core/rng';
import type { TrafficQuery, Vec2 } from '../../../core/types';
import type { FxFrame } from '../fx-frame';
import { createSpec } from '../particles/particle-pool';
import type { ParticleLayer } from '../particles/particle-layer';

/**
 * Anything that throws road spray when the road is wet. PlayerState fits as-is (width = mirror span); for other
 * vehicles pass their body width/length.
 */
export interface SpraySource {
  readonly pos: Vec2;
  readonly heading: number;
  /** signed m/s along heading */
  readonly speed: number;
  /** body width (m): < 1.2 = a two-wheeler (one tyre track), else two rear tyre tracks */
  readonly width: number;
  /** body length (m); spray leaves the rear tyres. Default 1.9 (a motorbike) */
  readonly length?: number;
}

/** NPC spray is only simulated this close to the rider */
const RANGE = 38;
const spec = createSpec();

/**
 * Tyre spray on wet roads: fine mist kicked up behind the rear tyres, rising and trailing behind, scaled by
 * speed × wetness. Register the rider (and any scripted vehicles) with `register`; NPC traffic is followed via
 * `track(trafficQuery)`.
 */
export class Spray {
  private readonly sources = new Set<SpraySource>();
  private traffic: TrafficQuery | null = null;

  constructor(private readonly mist: ParticleLayer, private readonly rng: Rng) {}

  /** start throwing spray for a source; returns the unregister function */
  register(src: SpraySource): () => void {
    this.sources.add(src);
    return () => this.sources.delete(src);
  }

  /** follow every NPC vehicle near the rider (null stops) */
  track(traffic: TrafficQuery | null): void {
    this.traffic = traffic;
  }

  update(f: FxFrame): void {
    const wet = f.state.wetness;
    if (wet < 0.15) return;
    for (const s of this.sources) this.emitFor(f, s, s.width, s.length ?? 1.9, wet);
    if (!this.traffic) return;
    for (const a of this.traffic.agents()) {
      if (Math.abs(a.speed) < 1.5) continue;
      if (Math.abs(a.pos.x - f.focus.x) > RANGE || Math.abs(a.pos.z - f.focus.z) > RANGE) continue;
      this.emitFor(f, a, a.spec.width, a.spec.length, wet);
    }
  }

  private emitFor(f: FxFrame, s: Pick<SpraySource, 'pos' | 'heading' | 'speed'>, width: number, length: number, wet: number): void {
    const v = Math.abs(s.speed);
    const k = smoothstep(1.5, 11, v) * smoothstep(0.15, 0.55, wet);
    if (k <= 0) return;
    const twin = width >= 1.2;
    const rate = (twin ? 46 : 26) * k * (0.5 + 0.5 * Math.min(1, width / 2));
    // stochastic rounding keeps the mean rate without per-source bookkeeping
    const n = Math.floor(rate * f.dt + this.rng.next());
    if (n <= 0) return;
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const dir = s.speed >= 0 ? 1 : -1;
    const back = (length / 2 - 0.35) * dir;
    const track = twin ? width / 2 - 0.28 : 0;
    const big = twin ? 1.35 : 1;
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      const side = twin ? (rng.next() < 0.5 ? -track : track) : 0;
      const jitter = rng.range(-0.12, 0.12);
      // right(θ) = (−cos θ, sin θ)
      spec.x = s.pos.x - fx * back - fz * (side + jitter);
      spec.z = s.pos.z - fz * back + fx * (side + jitter);
      spec.floor = f.groundHeight(spec.x, spec.z) + 0.05;
      spec.y = spec.floor + 0.08;
      const lift = rng.range(0.6, 1.5) * (0.6 + v / 22);
      const trail = rng.range(0.12, 0.38) * v * dir;
      const spread = rng.range(-0.7, 0.7) + Math.sign(side) * 0.35;
      spec.vx = fx * trail - fz * spread;
      spec.vz = fz * trail + fx * spread;
      spec.vy = lift;
      spec.life = rng.range(0.45, 0.85);
      spec.size0 = rng.range(0.16, 0.28) * big;
      spec.size1 = spec.size0 * rng.range(3, 4.2);
      spec.alpha = 0.34 * k;
      spec.r = spec.g = spec.b = 0.86;
      spec.drag = 2.4;
      spec.gravity = -2.4;
      this.mist.pool.emit(spec);
    }
  }
}
