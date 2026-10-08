import type { Rng } from '../../core/rng';

const SIZE = 64;

/**
 * Deterministic wind texture over time: smooth value noise from an Rng-seeded table (two octaves → gusts that
 * swell for a few seconds with quicker flutters on top) and a prevailing direction that wanders ±25°.
 */
export class Gusts {
  private readonly table = new Float32Array(SIZE);
  private readonly base: number;

  constructor(rng: Rng) {
    for (let i = 0; i < SIZE; i++) this.table[i] = rng.next();
    this.base = rng.range(-Math.PI, Math.PI);
  }

  /** gust factor 0..1 at clock time t (seconds) */
  at(t: number): number {
    return Math.min(1, Math.max(0, this.noise(t * 0.32) * 0.72 + this.noise(t * 1.4 + 17) * 0.28));
  }

  /** heading (sim convention) the wind blows toward at time t */
  heading(t: number): number {
    return this.base + (this.noise(t * 0.035 + 41) - 0.5) * 0.87;
  }

  /** smooth 1D value noise in 0..1 */
  private noise(x: number): number {
    const i = Math.floor(x);
    const f = x - i;
    const a = this.table[((i % SIZE) + SIZE) % SIZE];
    const b = this.table[(((i + 1) % SIZE) + SIZE) % SIZE];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }
}
