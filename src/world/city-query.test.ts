import { describe, expect, it } from 'vitest';
import type { StaticCollider } from '../core/types';
import { Surface } from '../core/types';
import { createCityQuery } from './city-query';
import { allCities, city } from './gen/test-fixtures';

describe('CityQuery', () => {
  it('finds the lane under a point with signed lateral offset (+ = left of travel)', () => {
    for (const c of allCities().slice(0, 6)) {
      const q = createCityQuery(c);
      const bad: string[] = [];
      for (const l of c.lanes) {
        if (l.length < 4) continue;
        const s = l.length / 2;
        const p = { x: l.start.x + l.dir.x * s + l.dir.z * 0.4, z: l.start.z + l.dir.z * s - l.dir.x * 0.4 };
        const hit = q.nearestLane(p);
        if (!hit || hit.lane.id !== l.id || Math.abs(hit.s - s) > 1e-6 || Math.abs(hit.lateral - 0.4) > 1e-6 || Math.abs(hit.dist - 0.4) > 1e-6) bad.push(`lane ${l.id}`);
        if (q.surfaceAt(l.start.x + l.dir.x * s, l.start.z + l.dir.z * s) !== Surface.Road) bad.push(`surface under lane ${l.id}`);
        if (q.roadNameAt(p) !== c.edges[l.edge].name) bad.push(`name ${l.id}: ${q.roadNameAt(p)} ≠ ${c.edges[l.edge].name}`);
      }
      expect(bad).toEqual([]);
      for (const p of c.pois) expect(q.nearestLane(p.pos)?.lane.id).toBe(p.lane);
      expect(q.roadNameAt(c.spawn.pos)).toBe(c.edges[c.lanes[c.pois[0].lane].edge].name);
      expect(q.nearestLane({ x: c.bounds.maxX + 50, z: 0 })).toBeNull();
    }
  });

  it('returns static colliders near a point and reports buildings on the surface raster', () => {
    const c = city(2, 'silom');
    const q = createCityQuery(c);
    const out: StaticCollider[] = [{ id: -1, tag: 'pole' }];
    for (const k of c.colliders.filter((_, i) => i % 7 === 0)) {
      const p = k.circle ? { x: k.circle.cx, z: k.circle.cz } : { x: k.obb?.cx ?? 0, z: k.obb?.cz ?? 0 };
      const n = q.staticNear(p, 0.5, out);
      expect(n).toBe(out.length);
      expect(out.some((o) => o.id === k.id)).toBe(true);
      if (k.tag === 'building') expect(q.surfaceAt(p.x, p.z)).toBe(Surface.Building);
    }
    expect(q.staticNear({ x: c.bounds.maxX + 100, z: c.bounds.maxZ + 100 }, 2, out)).toBe(0);
    expect(out.length).toBe(0);
  });

  it('knows shade: under the BTS viaduct yes, mid-carriageway of an open avenue no', () => {
    for (const c of allCities().slice(0, 8)) {
      const q = createCityQuery(c);
      for (const e of c.edges.filter((x) => x.skytrain)) {
        const a = c.nodes[e.a].pos;
        expect(q.shadedAt({ x: a.x + e.dir.x * e.length / 2, z: a.z + e.dir.z * e.length / 2 })).toBe(true);
      }
      const sky = c.edges.filter((x) => x.skytrain);
      const open = c.lanes.filter((l) => {
        const e = c.edges[l.edge];
        if (e.cls === 'soi' || e.skytrain || l.index !== 0 || l.length < 30) return false;
        const m = { x: (l.start.x + l.end.x) / 2, z: (l.start.z + l.end.z) / 2 };
        return sky.every((g) => Math.abs((m.x - c.nodes[g.a].pos.x) * g.dir.z - (m.z - c.nodes[g.a].pos.z) * g.dir.x) > 40);
      });
      const unshaded = open.filter((l) => !q.shadedAt({ x: (l.start.x + l.end.x) / 2, z: (l.start.z + l.end.z) / 2 }));
      if (open.length) expect(unshaded.length / open.length).toBeGreaterThan(0.6);
    }
  });

  it('answers hot-path queries fast (100k nearestLane + staticNear + surfaceAt)', () => {
    const c = city(7, 'sukhumvit');
    const q = createCityQuery(c);
    const out: StaticCollider[] = [];
    let found = 0;
    const t0 = performance.now();
    for (let i = 0; i < 100000; i++) {
      const p = { x: ((i * 7919) % 500) - 250, z: ((i * 104729) % 500) - 250 };
      if (q.nearestLane(p)) found++;
      q.staticNear(p, 2, out);
      q.surfaceAt(p.x, p.z);
    }
    const ms = performance.now() - t0;
    expect(found).toBeGreaterThan(1000);
    // ~120 ms on an idle machine; the margin keeps it meaningful (O(n) scans take seconds) yet stable under CPU load
    expect(ms).toBeLessThan(1200);
  });
});
