import { describe, expect, it } from 'vitest';
import { generateCity } from './generate';
import { allCities, city } from './test-fixtures';

const KMH = 3.6;

describe('road network', () => {
  it('is deterministic per (seed, district) and differs between seeds', () => {
    const a = generateCity(11, 'yaowarat');
    const b = generateCity(11, 'yaowarat');
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    const c = generateCity(12, 'yaowarat');
    expect(JSON.stringify(c.edges.map((e) => [e.a, e.b, Math.round(e.length)]))).not.toBe(JSON.stringify(a.edges.map((e) => [e.a, e.b, Math.round(e.length)])));
    const other = generateCity(11, 'silom');
    expect(other.nodes.length === a.nodes.length && other.edges.every((e, i) => e.length === a.edges[i]?.length)).toBe(false);
  });

  it('keeps LEFT-hand traffic: forward lanes on the left of a→b (offset > 0), index 0 nearest the centre', () => {
    for (const c of allCities()) {
      for (const l of c.lanes) {
        const e = c.edges[l.edge];
        const a = c.nodes[e.a].pos;
        expect(Math.sign(l.offset)).toBe(l.forward ? 1 : -1);
        // geometric side of the lane centre relative to the a→b centreline, left = (dir.z, −dir.x)
        const lat = (l.start.x - a.x) * e.dir.z - (l.start.z - a.z) * e.dir.x;
        expect(lat).toBeCloseTo(l.offset, 4);
        // a forward lane travels a→b, and its own LEFT points away from the centreline (towards the curb)
        const travel = l.forward ? e.dir : { x: -e.dir.x, z: -e.dir.z };
        expect(l.dir.x * travel.x + l.dir.z * travel.z).toBeCloseTo(1, 6);
        const fromCentre = { x: e.dir.z * lat, z: -e.dir.x * lat };
        expect(fromCentre.x * l.dir.z - fromCentre.z * l.dir.x).toBeGreaterThan(0);
        expect(Math.abs(l.offset)).toBeCloseTo(e.median / 2 + (l.index + 0.5) * e.laneWidth, 6);
      }
    }
  }, 20_000); // generates several full cities: give it room when the CPU is busy

  it('has the Bangkok road hierarchy: main 3+3 with median, avenue 2+2, sois 1+1 or one-way, speed limits', () => {
    for (const c of allCities()) {
      const mains = c.edges.filter((e) => e.cls === 'main');
      expect(mains.length).toBeGreaterThan(0);
      for (const e of c.edges) {
        const speed = c.lanes.find((l) => l.edge === e.id)?.speedLimit ?? 0;
        if (e.cls === 'main') {
          expect([e.lanesAB, e.lanesBA, e.median > 1.8, e.sidewalk]).toEqual([3, 3, true, 3.5]);
          expect(Math.round(speed * KMH)).toBe(50);
        } else if (e.cls === 'avenue') {
          expect([e.lanesAB, e.lanesBA, e.median, e.sidewalk]).toEqual([2, 2, 0, 3]);
          expect(Math.round(speed * KMH)).toBe(40);
        } else {
          expect(e.oneWay ? [e.lanesAB, e.lanesBA] : [1, 1]).toEqual(e.oneWay ? [1, 0] : [e.lanesAB, e.lanesBA]);
          expect(e.laneWidth * 2).toBeGreaterThanOrEqual(6);
          expect(e.laneWidth * 2).toBeLessThanOrEqual(7);
          expect([0, 1.5, 2.5]).toContain(e.sidewalk);
          expect(Math.round(speed * KMH)).toBe(25);
        }
      }
      expect(c.edges.some((e) => e.skytrain && e.cls === 'main')).toBe(true);
    }
    const cities = allCities();
    expect(cities.some((c) => c.edges.some((e) => e.oneWay))).toBe(true);
    expect(cities.every((c) => c.nodes.some((n) => n.edges.length === 1 && Math.abs(n.pos.x) < 255 && Math.abs(n.pos.z) < 255))).toBe(true);
    expect(cities.some((c) => c.edges.some((e) => e.cls === 'soi' && e.sidewalk === 0))).toBe(true);
  });

  it('signals exactly where two different major roads cross; soi junctions stay unsignalised', () => {
    for (const c of allCities()) {
      for (const n of c.nodes) {
        const majorNames = new Set(n.edges.map((id) => c.edges[id]).filter((e) => e.cls !== 'soi').map((e) => e.name));
        expect(n.signal).toBe(n.edges.length >= 3 && majorNames.size >= 2);
        const widest = Math.max(...n.edges.map((id) => c.edges[id].median / 2 + Math.max(c.edges[id].lanesAB, c.edges[id].lanesBA) * c.edges[id].laneWidth));
        if (n.edges.length >= 3) expect(n.radius).toBeGreaterThanOrEqual(widest);
      }
      expect(c.nodes.some((n) => n.signal)).toBe(true);
    }
  });

  it('connectors run from a lane end to a lane start as sampled curves following the turn rules', () => {
    for (const c of allCities()) {
      for (const k of c.connectors) {
        const from = c.lanes[k.from];
        const to = c.lanes[k.to];
        expect(k.points.length).toBeGreaterThanOrEqual(6);
        expect(Math.hypot(k.points[0].x - from.end.x, k.points[0].z - from.end.z)).toBeLessThan(1e-6);
        const last = k.points[k.points.length - 1];
        expect(Math.hypot(last.x - to.start.x, last.z - to.start.z)).toBeLessThan(1e-6);
        expect(from.out).toContain(k.id);
        expect(to.in).toContain(k.id);
        const approach = c.lanes.filter((l) => l.edge === from.edge && l.forward === from.forward);
        const nIn = approach.length;
        const turns = new Set(approach.flatMap((l) => l.out.map((id) => c.connectors[id].turn)));
        if (turns.has('straight')) {
          if (k.turn === 'left') expect(from.index).toBe(nIn - 1);
          if (k.turn === 'right') expect(from.index).toBe(0);
        } else if (turns.has('left') && turns.has('right') && nIn > 1) {
          if (k.turn === 'left') expect(from.index).toBeGreaterThanOrEqual(Math.floor(nIn / 2));
          if (k.turn === 'right') expect(from.index).toBeLessThan(Math.floor(nIn / 2));
        }
        if (k.turn === 'uturn') {
          const n = c.nodes[k.node];
          expect(n.edges.length === 1 || c.edges[from.edge].median > 0).toBe(true);
        }
        expect(k.length).toBeGreaterThan(0);
      }
      const uturnOpenings = c.connectors.filter((k) => k.turn === 'uturn' && c.nodes[k.node].edges.length === 2);
      expect(uturnOpenings.length).toBeGreaterThan(0);
    }
  });

  it('gives every lane somewhere to go (no trap lanes)', () => {
    for (const c of allCities()) for (const l of c.lanes) expect(l.out.length).toBeGreaterThan(0);
  });

  it('is laid out over ~520 m with dozens of sois', () => {
    const c = city(1, 'sukhumvit');
    expect(c.bounds.maxX - c.bounds.minX).toBeGreaterThanOrEqual(500);
    expect(c.bounds.maxX - c.bounds.minX).toBeLessThanOrEqual(540);
    for (const x of allCities()) expect(new Set(x.edges.filter((e) => e.cls === 'soi').map((e) => e.name)).size).toBeGreaterThanOrEqual(10);
  });
});
