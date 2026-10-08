import type { Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { headingOf } from '../../core/math2d';
import type { DistrictDef } from './district-types';
import { MODULE } from './frontages';
import type { RoadNet } from './net-types';
import type { PlaceCtx } from './place-ctx';
import { buildingLine } from './road-profile';
import { onBounds } from './road-geometry';
import { rowLook } from './signage';
import { pickW } from './weighted';

interface Corridor {
  p: Vec2;
  /** unit direction pointing out of the map */
  d: Vec2;
  half: number;
}

/** where exit roads leave the map: nothing is built on their extension */
function corridors(net: RoadNet): Corridor[] {
  return net.nodes
    .filter((n) => n.edges.length === 1 && onBounds(n.pos, net.bounds))
    .map((n) => {
      const e = net.edges[n.edges[0]];
      const d = e.b === n.id ? e.dir : { x: -e.dir.x, z: -e.dir.z };
      return { p: n.pos, d, half: buildingLine(e) + 2 };
    });
}

const blocked = (C: readonly Corridor[], p: Vec2, extra: number): boolean =>
  C.some((c) => {
    const s = (p.x - c.p.x) * c.d.x + (p.z - c.p.z) * c.d.z;
    const l = Math.abs((p.x - c.p.x) * c.d.z - (p.z - c.p.z) * c.d.x);
    return s > -4 && l < c.half + extra;
  });

/**
 * Outside the playable square (visual only, no colliders): a fringe of shophouse rows facing into the city just
 * beyond the boundary, and a ring of condo / office towers further out for the skyline (meta.skyline = '1').
 */
export function placeSkyline(net: RoadNet, ctx: PlaceCtx, def: DistrictDef, rng: Rng): void {
  const C = corridors(net);
  const b = net.bounds;
  const half = (b.maxX - b.minX) / 2;
  const sides: Array<[Vec2, Vec2]> = [[{ x: 0, z: -1 }, { x: 1, z: 0 }], [{ x: 0, z: 1 }, { x: -1, z: 0 }], [{ x: -1, z: 0 }, { x: 0, z: -1 }], [{ x: 1, z: 0 }, { x: 0, z: 1 }]];
  for (const [out, along] of sides) {
    const heading = headingOf({ x: -out.x, z: -out.z });
    let look = rowLook(rng, def);
    const ext = along.x !== 0 ? half + 12 : half - 2;
    for (let u = -ext; u <= ext; u += MODULE) {
      if (rng.chance(0.15)) look = rowLook(rng, def);
      const pos = { x: out.x * (half + 2) + along.x * u, z: out.z * (half + 2) + along.z * u };
      if (blocked(C, pos, 2) || rng.chance(0.05)) continue;
      ctx.add(pickW(rng, def.floors), pos, heading, { meta: { wall: look.wall, awning: look.awning, shutter: 'closed', fringe: '1', style: def.signs.style } });
    }
  }
  const density = Math.min(0.85, 0.3 + def.recipe.tower * 2.4);
  for (let z = -half - 240; z <= half + 240; z += 36) {
    for (let x = -half - 240; x <= half + 240; x += 36) {
      const ring = Math.max(Math.abs(x), Math.abs(z)) - half;
      if (ring < 40 || !rng.chance(density * (1 - ring / 300))) continue;
      const p = { x: x + rng.range(-10, 10), z: z + rng.range(-10, 10) };
      if (blocked(C, p, 14)) continue;
      const toward = headingOf({ x: -p.x, z: -p.z });
      const h = Math.round(toward / (Math.PI / 2)) * (Math.PI / 2) + rng.range(-0.08, 0.08);
      ctx.add(pickW(rng, def.recipe.towerKinds), p, h, { scale: rng.range(0.8, 1.5), meta: { skyline: '1' } });
    }
  }
}
