/** One particle to spawn (a reusable struct: emitters fill it and call `ParticlePool.emit`). */
export interface ParticleSpec {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** seconds */
  life: number;
  /** world size (m) at birth / death */
  size0: number;
  size1: number;
  /** peak opacity */
  alpha: number;
  /** albedo (linear) — the layer lights it */
  r: number;
  g: number;
  b: number;
  /** s⁻¹ pull toward the wind velocity (air drag) */
  drag: number;
  /** m/s² vertical (negative = falls, positive = buoyant) */
  gravity: number;
  /** particles never sink below this height (they settle on the road) */
  floor: number;
}

export const createSpec = (): ParticleSpec => ({
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size0: 0.2, size1: 0.6, alpha: 0.2, r: 1, g: 1, b: 1, drag: 1,
  gravity: 0, floor: 0,
});

const FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'age', 'life', 's0', 's1', 'a', 'r', 'g', 'b', 'drag', 'grav', 'floor'] as const;
type Field = (typeof FIELDS)[number];

/**
 * Fixed-capacity CPU particle simulation (structure of arrays, no allocation per frame). Dead particles are
 * swap-removed, so live ones are always packed in [0, count). When full, new spawns are dropped.
 */
export class ParticlePool {
  count = 0;
  /** live budget ≤ capacity (a quality step-down lowers it without reallocating) */
  limit: number;
  readonly f: Record<Field, Float32Array>;

  constructor(readonly capacity: number) {
    this.limit = capacity;
    const f = {} as Record<Field, Float32Array>;
    for (const k of FIELDS) f[k] = new Float32Array(capacity);
    this.f = f;
  }

  emit(s: ParticleSpec): boolean {
    if (this.count >= this.limit || s.life <= 0) return false;
    const i = this.count++;
    const f = this.f;
    f.x[i] = s.x;
    f.y[i] = s.y;
    f.z[i] = s.z;
    f.vx[i] = s.vx;
    f.vy[i] = s.vy;
    f.vz[i] = s.vz;
    f.age[i] = 0;
    f.life[i] = s.life;
    f.s0[i] = s.size0;
    f.s1[i] = s.size1;
    f.a[i] = s.alpha;
    f.r[i] = s.r;
    f.g[i] = s.g;
    f.b[i] = s.b;
    f.drag[i] = s.drag;
    f.grav[i] = s.gravity;
    f.floor[i] = s.floor;
    return true;
  }

  /** integrate (semi-implicit Euler), drag toward the wind, settle on the floor, retire the dead */
  step(dt: number, windX: number, windZ: number): void {
    const f = this.f;
    for (let i = 0; i < this.count; i++) {
      f.age[i] += dt;
      if (f.age[i] >= f.life[i]) {
        this.kill(i--);
        continue;
      }
      const k = Math.min(1, f.drag[i] * dt);
      f.vx[i] += (windX - f.vx[i]) * k;
      f.vz[i] += (windZ - f.vz[i]) * k;
      f.vy[i] = (f.vy[i] + f.grav[i] * dt) * (1 - k * 0.5);
      f.x[i] += f.vx[i] * dt;
      f.y[i] += f.vy[i] * dt;
      f.z[i] += f.vz[i] * dt;
      if (f.y[i] < f.floor[i]) {
        f.y[i] = f.floor[i];
        f.vy[i] = 0;
      }
    }
  }

  /** 0..1 life fraction of particle i */
  t(i: number): number {
    return this.f.age[i] / this.f.life[i];
  }

  clear(): void {
    this.count = 0;
  }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const k of FIELDS) this.f[k][i] = this.f[k][last];
  }
}
