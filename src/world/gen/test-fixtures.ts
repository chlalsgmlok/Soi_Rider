import type { CityData, DistrictId, Lane, OBB } from '../../core/types';
import { generateCity } from './generate';

/** Test-only helpers: a cached spread of generated cities and lane geometry written independently of the generator. */

export const TEST_DISTRICTS: readonly DistrictId[] = ['sukhumvit', 'siam', 'yaowarat', 'khaosan', 'silom'];
export const TEST_SEEDS: readonly number[] = [1, 2, 7, 42];

const cache = new Map<string, CityData>();

export function city(seed: number, district: DistrictId): CityData {
  const key = `${seed}:${district}`;
  let c = cache.get(key);
  if (!c) {
    c = generateCity(seed, district);
    cache.set(key, c);
  }
  return c;
}

/** every (seed, district) pair of the test matrix */
export function allCities(): CityData[] {
  return TEST_DISTRICTS.flatMap((d) => TEST_SEEDS.map((s) => city(s, d)));
}

/** the four corners of a lane's paved rectangle, in order */
export function laneCorners(l: Lane): Array<{ x: number; z: number }> {
  const lx = l.dir.z * (l.width / 2);
  const lz = -l.dir.x * (l.width / 2);
  return [
    { x: l.start.x + lx, z: l.start.z + lz }, { x: l.end.x + lx, z: l.end.z + lz },
    { x: l.end.x - lx, z: l.end.z - lz }, { x: l.start.x - lx, z: l.start.z - lz },
  ];
}

export function obbCorners(o: OBB): Array<{ x: number; z: number }> {
  const f = { x: Math.sin(o.angle), z: Math.cos(o.angle) };
  const r = { x: -Math.cos(o.angle), z: Math.sin(o.angle) };
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => ({
    x: o.cx + r.x * o.hw * u + f.x * o.hl * v, z: o.cz + r.z * o.hw * u + f.z * o.hl * v,
  }));
}

type P = { x: number; z: number };

/** separating-axis overlap of two convex polygons; `gap` > 0 also counts near-touching as overlap */
export function polygonsOverlap(a: readonly P[], b: readonly P[], gap = 0): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      const n = { x: -(q.z - p.z) / len, z: (q.x - p.x) / len };
      const proj = (pts: readonly P[]): [number, number] => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const v of pts) {
          const t = v.x * n.x + v.z * n.z;
          lo = Math.min(lo, t);
          hi = Math.max(hi, t);
        }
        return [lo, hi];
      };
      const [a0, a1] = proj(a);
      const [b0, b1] = proj(b);
      if (a1 + gap <= b0 || b1 + gap <= a0) return false;
    }
  }
  return true;
}

/** distance from point p to a convex polygon (0 inside) */
export function pointPolygonDist(p: P, poly: readonly P[]): number {
  let pos = 0;
  let neg = 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const side = ex * (p.z - a.z) - ez * (p.x - a.x);
    if (side > 1e-9) pos++;
    else if (side < -1e-9) neg++;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(p.x - (a.x + ex * t), p.z - (a.z + ez * t)));
  }
  return pos === 0 || neg === 0 ? 0 : best;
}
