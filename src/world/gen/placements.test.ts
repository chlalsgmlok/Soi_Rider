import { describe, expect, it } from 'vitest';
import type { CityData, StaticCollider } from '../../core/types';
import { DRIVABLE } from '../surface-map';
import { buildSurfaceMap } from './surface-build';
import { generateCity } from './generate';
import { allCities, laneCorners, obbCorners, pointPolygonDist, polygonsOverlap } from './test-fixtures';

/** lane graph walk written independently of the generator: connectors + lane changes within one edge direction */
function reach(c: CityData, start: number, reverse: boolean): Set<number> {
  const adj = new Map<number, number[]>();
  const add = (a: number, b: number): void => {
    const [p, q] = reverse ? [b, a] : [a, b];
    adj.set(p, [...(adj.get(p) ?? []), q]);
  };
  for (const k of c.connectors) add(k.from, k.to);
  for (const l of c.lanes) {
    for (const m of c.lanes) if (m.edge === l.edge && m.forward === l.forward && Math.abs(m.index - l.index) === 1) add(l.id, m.id);
  }
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) for (const n of adj.get(queue.shift() as number) ?? []) if (!seen.has(n)) seen.add(n), queue.push(n);
  return seen;
}

const ELEVATED = new Set(['bts_deck', 'bts_station']);
const outside = (c: CityData, x: number, z: number): boolean => x < c.bounds.minX || x > c.bounds.maxX || z < c.bounds.minZ || z > c.bounds.maxZ;

function colliderPoly(k: StaticCollider): Array<{ x: number; z: number }> | null {
  return k.obb ? obbCorners(k.obb) : null;
}

describe('city dressing', () => {
  it('names 14–24 stops (Korean + Thai), spawn first = the win stand, landmarks flagged', () => {
    for (const c of allCities()) {
      expect(c.pois.length).toBeGreaterThanOrEqual(14);
      expect(c.pois.length).toBeLessThanOrEqual(24);
      expect(c.spawn.poi).toBe(0);
      expect(c.pois[0].kind).toBe('win_stand');
      for (const p of c.pois) {
        expect(p.name.length).toBeGreaterThan(0);
        expect(/[฀-๿]/.test(p.nameTh)).toBe(true);
        if (p.kind === 'temple' || p.kind === 'shrine' || p.kind === 'park') expect(p.landmark).toBe(true);
      }
      expect(new Set(c.pois.map((p) => p.name)).size).toBe(c.pois.length);
    }
  });

  it('puts every stop at a curbside point inside its curb lane, facing along it', () => {
    for (const c of allCities()) {
      for (const p of c.pois) {
        const l = c.lanes[p.lane];
        const sibling = c.lanes.filter((m) => m.edge === l.edge && m.forward === l.forward);
        expect(l.index).toBe(sibling.length - 1);
        const s = (p.pos.x - l.start.x) * l.dir.x + (p.pos.z - l.start.z) * l.dir.z;
        const lat = (p.pos.x - l.start.x) * l.dir.z - (p.pos.z - l.start.z) * l.dir.x;
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(l.length);
        expect(lat).toBeGreaterThan(0);
        expect(lat).toBeLessThan(l.width / 2);
        expect(Math.abs(Math.sin(p.heading) - l.dir.x) + Math.abs(Math.cos(p.heading) - l.dir.z)).toBeLessThan(1e-6);
      }
      expect(c.spawn.pos).toEqual(c.pois[0].pos);
    }
  });

  it('lets the rider reach every stop from the spawn and get back', () => {
    for (const c of allCities()) {
      const start = c.pois[0].lane;
      const fwd = reach(c, start, false);
      const back = reach(c, start, true);
      for (const p of c.pois) {
        expect(fwd.has(p.lane), `${c.district}/${c.seed} ${p.name} reachable`).toBe(true);
        expect(back.has(p.lane), `${c.district}/${c.seed} ${p.name} returns`).toBe(true);
      }
    }
  });

  it('keeps placements off the carriageway (elevated BTS and out-of-map skyline excepted)', () => {
    const bad: string[] = [];
    for (const c of allCities()) {
      const map = buildSurfaceMap(c);
      for (const p of c.placements) {
        if (ELEVATED.has(p.asset) || outside(c, p.pos.x, p.pos.z)) continue;
        const code = map.at(p.pos.x, p.pos.z);
        if (DRIVABLE & (1 << code)) bad.push(`${c.district}/${c.seed} ${p.asset} @${p.pos.x.toFixed(1)},${p.pos.z.toFixed(1)} on ${code}`);
      }
      for (const k of c.colliders) {
        if (k.tag !== 'building' || !k.obb) continue;
        const o = k.obb;
        if (!map.rectAll({ x: o.cx, z: o.cz }, { x: Math.sin(o.angle), z: Math.cos(o.angle) }, -o.hl, o.hl, -o.hw, o.hw, ~DRIVABLE)) bad.push(`${c.district}/${c.seed} building ${k.id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('never lets a static collider intrude into a lane', () => {
    const bad: string[] = [];
    for (const c of allCities()) {
      const lanes = c.lanes.map((l) => ({ l, poly: laneCorners(l), cx: (l.start.x + l.end.x) / 2, cz: (l.start.z + l.end.z) / 2 }));
      for (const k of c.colliders) {
        const cx = k.circle?.cx ?? k.obb?.cx ?? 0;
        const cz = k.circle?.cz ?? k.obb?.cz ?? 0;
        const size = k.circle?.r ?? Math.hypot(k.obb?.hw ?? 0, k.obb?.hl ?? 0);
        const cp = colliderPoly(k);
        for (const { l, poly, cx: lx, cz: lz } of lanes) {
          if (Math.hypot(cx - lx, cz - lz) > l.length / 2 + l.width + size + 1) continue;
          const hit = k.circle ? pointPolygonDist({ x: cx, z: cz }, poly) < k.circle.r : cp !== null && polygonsOverlap(cp, poly, -1e-6);
          if (hit) bad.push(`${c.district}/${c.seed} ${k.tag} ${k.id} vs lane ${l.id}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('links placements to valid colliders and rebuilds the identical surface raster from data alone', () => {
    for (const c of allCities()) {
      expect(c.placements.filter((p) => p.collider !== null && c.colliders[p.collider]?.id !== p.collider)).toEqual([]);
      const fresh = buildSurfaceMap(JSON.parse(JSON.stringify(c)) as CityData);
      const cached = buildSurfaceMap(c);
      expect(fresh === cached).toBe(false);
      let diff = 0;
      for (let i = 0; i < fresh.data.length; i++) if (fresh.data[i] !== cached.data[i]) diff++;
      expect(diff).toBe(0);
    }
  });

  it('dresses the street: shophouse rows, BTS pillars on the median, signals facing approaching traffic', () => {
    for (const c of allCities()) {
      const count = (a: string): number => c.placements.filter((p) => p.asset === a).length;
      expect(c.placements.filter((p) => p.asset.startsWith('bld_shophouse')).length).toBeGreaterThan(300);
      expect(count('bts_pillar')).toBeGreaterThan(8);
      expect(count('bts_station')).toBe(1);
      expect(count('prop_soi_sign')).toBeGreaterThan(5);
      expect(count('prop_power_pole')).toBeGreaterThan(20);
      expect(c.placements.filter((p) => p.asset === 'prop_win_stand' && p.meta?.home === '1').length).toBe(1);
      expect(c.frontages.filter((f) => f.kind === 'shophouse').length).toBeGreaterThan(40);
      const map = buildSurfaceMap(c);
      for (const p of c.placements.filter((x) => x.asset === 'bts_pillar')) expect(map.at(p.pos.x, p.pos.z)).toBe(3);
      for (const p of c.placements.filter((x) => x.asset === 'prop_traffic_light')) {
        const e = c.edges[Number(p.meta?.edge)];
        const n = c.nodes[Number(p.meta?.node)];
        expect(n.signal).toBe(true);
        const travel = e.b === n.id ? e.dir : { x: -e.dir.x, z: -e.dir.z };
        const facing = { x: -Math.cos(p.heading), z: Math.sin(p.heading) };
        expect(facing.x * travel.x + facing.z * travel.z).toBeCloseTo(-1, 6);
        expect((p.pos.x - n.pos.x) * travel.z - (p.pos.z - n.pos.z) * travel.x).toBeGreaterThan(0);
      }
    }
  });

  it('generates a district in well under 150 ms', () => {
    generateCity(3, 'siam');
    const times: number[] = [];
    for (let s = 100; s < 110; s++) {
      const t0 = performance.now();
      generateCity(s, s % 2 ? 'sukhumvit' : 'yaowarat');
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(150);
  });
});
