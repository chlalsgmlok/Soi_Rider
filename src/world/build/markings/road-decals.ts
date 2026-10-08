import type { Rng } from '../../../core/rng';
import type { Circle, CityData, Lane, Vec2 } from '../../../core/types';
import type { ChunkSet } from '../kit/chunk-set';
import { BIKE_BOX_DEPTH, GUTTER_W } from '../kit/dims';
import type { EdgeSpan } from '../ground/edge-spans';
import { glyph, MARK_Y } from './decal';
import type { MarkingsAtlas } from './markings-atlas';

const SPAWN_CLEAR = 7;

/**
 * Street wear on the asphalt: manhole covers in the lanes, storm grates in the gutters, darker repair patches and oil
 * stains where cars queue at signals. Returns the low spots where rain collects (beside grates, soi potholes).
 */
export function buildRoadDecals(data: CityData, spans: readonly EdgeSpan[], byEdge: readonly Lane[][], chunks: ChunkSet, atlas: MarkingsAtlas, rng: Rng): Circle[] {
  const puddles: Circle[] = [];
  const addPuddle = (p: Vec2, r: number): void => {
    if (Math.hypot(p.x - data.spawn.pos.x, p.z - data.spawn.pos.z) < SPAWN_CLEAR) return;
    puddles.push({ cx: p.x, cz: p.z, r });
  };
  for (const S of spans) {
    const { F, e, hw } = S;
    const len = e.length;
    const pt = (s: number, l: number): Vec2 => ({ x: F.o.x + F.d.x * s + F.d.z * l, z: F.o.z + F.d.z * s - F.d.x * l });
    for (const ln of byEdge[e.id]) {
      for (let s = rng.range(6, 24); s < ln.length - 4; s += rng.range(26, 46)) {
        const p = { x: ln.start.x + ln.dir.x * s, z: ln.start.z + ln.dir.z * s };
        const a = rng.range(0, Math.PI * 2);
        glyph(chunks, p.x + rng.range(-0.4, 0.4) * ln.dir.z, p.z - rng.range(-0.4, 0.4) * ln.dir.x, Math.sin(a), Math.cos(a), 0.86, 0.86, atlas.rect('manhole'), MARK_Y - 0.004);
      }
    }
    for (const sp of S.sides) {
      const c0 = Math.max(sp.c0, 0);
      const c1 = Math.min(sp.c1, len);
      for (let s = c0 + rng.range(3, 8); s < c1 - 2; s += rng.range(10, 16)) {
        const g = pt(s, sp.side * (hw - GUTTER_W / 2));
        glyph(chunks, g.x, g.z, F.d.x, F.d.z, 0.42, 0.9, atlas.rect('grate'), MARK_Y - 0.004);
        if (rng.chance(0.3)) addPuddle(pt(s + rng.range(-0.8, 0.8), sp.side * (hw - GUTTER_W - rng.range(0.3, 0.8))), rng.range(0.9, 1.7));
      }
    }
    const patches = Math.floor((len / 45) * rng.range(0.6, 1.6));
    for (let k = 0; k < patches; k++) {
      const p = pt(rng.range(3, Math.max(4, len - 3)), rng.range(-hw + 1, hw - 1));
      const tilt = rng.range(-0.15, 0.15);
      const fx = F.d.x * Math.cos(tilt) - F.d.z * Math.sin(tilt);
      const fz = F.d.z * Math.cos(tilt) + F.d.x * Math.sin(tilt);
      glyph(chunks, p.x, p.z, fx, fz, rng.range(1.2, 2.6), rng.range(1.8, 4.2), atlas.rect(rng.pick(['patch0', 'patch1', 'patch2'] as const)), MARK_Y - 0.007);
    }
    if (e.cls === 'soi' && rng.chance(0.55)) {
      const s = rng.range(4, Math.max(5, len - 4));
      addPuddle(pt(s, rng.range(-hw + 0.8, hw - 0.8)), rng.range(0.7, 1.3));
    }
  }
  for (const n of data.nodes) {
    if (!n.signal) continue;
    for (const id of n.edges) {
      for (const ln of byEdge[id]) {
        const e = data.edges[id];
        if (!(ln.forward ? e.b === n.id : e.a === n.id)) continue;
        const s = ln.length - BIKE_BOX_DEPTH - rng.range(2.4, 4.2);
        if (s < 2) continue;
        glyph(chunks, ln.start.x + ln.dir.x * s, ln.start.z + ln.dir.z * s, ln.dir.x, ln.dir.z, 1.1, 1.7, atlas.rect('oil'), MARK_Y - 0.006);
      }
    }
  }
  return puddles;
}
