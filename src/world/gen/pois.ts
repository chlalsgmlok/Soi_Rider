import type { Connector, Lane, Placement, POI, RoadClass, Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { dist, headingOf } from '../../core/math2d';
import type { BtsLine } from './bts';
import type { DistrictDef, PoiSpec } from './district-types';
import type { LaneIndex } from './lanes';
import { laneReach } from './lane-reach';
import type { LotFrame } from './lot-frame';
import type { PlacedLot } from './lots';
import type { RoadNet } from './net-types';
import type { PlaceCtx } from './place-ctx';
import { curbLane, laneS, sideOfEdge } from './poi-anchor';
import { onBounds } from './road-geometry';
import { sideFrame } from './side-frame';
import { curbPoint, type SpawnSite } from './spawn';
import { foodStall } from './street-food';

export interface PoiInputs {
  net: RoadNet;
  lanes: readonly Lane[];
  index: LaneIndex;
  connectors: readonly Connector[];
  ctx: PlaceCtx;
  def: DistrictDef;
  specs: readonly PoiSpec[];
  lots: readonly PlacedLot[];
  sites: ReadonlyMap<PoiSpec, LotFrame>;
  bts: BtsLine | null;
  spawn: SpawnSite;
}

interface Anchor {
  lane: Lane;
  s: number;
}

/** generic stops keep this far apart (and from the spawn) so every trip is a real ride */
const SPACING = 36;

/**
 * Named stops of the run: the spawn win stand first, then every selected POI at a curbside point inside the curb
 * lane in front of its lot / site / station / dead end, or on a random road of its class. Only lanes mutually
 * reachable with the spawn lane are used, so every stop can be driven to and back.
 */
export function placePois(I: PoiInputs, rng: Rng): POI[] {
  const { net, lanes, index, def, spawn } = I;
  const reach = laneReach(lanes, I.connectors, spawn.lane);
  const ok = (l: Lane | null): l is Lane => l !== null && reach[l.id] === 1 && l.length >= 6;
  const taken: Vec2[] = [spawn.pos];
  const shops = I.ctx.placements.filter((p) => p.asset.startsWith('bld_shophouse') && p.meta && !p.meta.infill && !p.meta.fringe);
  const pois: POI[] = [{
    id: 0, kind: 'win_stand', name: def.spawnPoi.name, nameTh: def.spawnPoi.th, pos: spawn.pos, lane: spawn.lane, heading: spawn.heading, landmark: false,
  }];

  const inFront = (lot: LotFrame): Anchor | null => {
    const e = net.edges[lot.edge];
    const side = sideOfEdge(net, e, lot.c);
    for (const l of [curbLane(lanes, index, e, side), curbLane(lanes, index, e, -side)]) if (ok(l)) return { lane: l, s: laneS(l, lot.c) };
    return null;
  };
  const station = (): Anchor | null => {
    const B = I.bts;
    if (!B || Number.isNaN(B.station)) return null;
    const p = { x: B.o.x + B.dir.x * B.station, z: B.o.z + B.dir.z * B.station };
    const e = B.edges.find((g) => {
      const s = (p.x - net.nodes[g.a].pos.x) * g.dir.x + (p.z - net.nodes[g.a].pos.z) * g.dir.z;
      return s >= 0 && s <= g.length;
    });
    const l = e ? curbLane(lanes, index, e, rng.chance(0.5) ? 1 : -1) : null;
    return ok(l) ? { lane: l, s: laneS(l, p) } : null;
  };
  const deadEnd = (): Anchor | null => {
    const ends = net.nodes.filter((n) => n.edges.length === 1 && !onBounds(n.pos, net.bounds));
    const edge = (x: Vec2): number => Math.min(x.x - net.bounds.minX, net.bounds.maxX - x.x, x.z - net.bounds.minZ, net.bounds.maxZ - x.z);
    for (const n of ends.sort((p, q) => edge(p.pos) - edge(q.pos))) {
      const e = net.edges[n.edges[0]];
      const ids = e.b === n.id ? index.fwd[e.id] : index.back[e.id];
      const l = ids.length ? lanes[ids[ids.length - 1]] : null;
      if (ok(l) && taken.every((t) => dist(t, l.end) > SPACING)) return { lane: l, s: Math.max(1, l.length - 6) };
    }
    return null;
  };
  const curbs = lanes.filter((l) => ok(l) && l.length >= 16 && isCurb(l, index));
  const generic = (cls: RoadClass | 'any'): Anchor | null => {
    const pool = cls === 'any' ? curbs : curbs.filter((l) => net.edges[l.edge].cls === cls);
    for (let k = 0; k < 60 && pool.length; k++) {
      const l = rng.weighted(pool, (x) => x.length);
      const s = rng.range(5, l.length - 5);
      if (taken.every((t) => dist(t, curbPoint(l, s)) > SPACING)) return { lane: l, s };
    }
    return null;
  };
  const classOf = (w: string): RoadClass | 'any' => {
    if (w === 'avenue' && !net.edges.some((e) => e.cls === 'avenue')) return 'main';
    return w === 'main' || w === 'avenue' || w === 'soi' ? w : 'any';
  };

  for (const spec of I.specs) {
    const lotKey = spec.where.startsWith('lot:') ? spec.where.slice(4) : null;
    const lot = lotKey ? I.lots.find((l) => l.key === lotKey)?.lot : I.sites.get(spec);
    const a = lot ? inFront(lot)
      : spec.where === 'station' ? station()
      : spec.where === 'deadEnd' ? deadEnd() ?? generic('soi')
      : generic(classOf(spec.where)) ?? generic('any');
    if (!a) continue;
    const pos = curbPoint(a.lane, a.s);
    taken.push(pos);
    pois.push({
      id: pois.length, kind: spec.kind, name: spec.name, nameTh: spec.th, pos, lane: a.lane.id,
      heading: headingOf(a.lane.dir), landmark: spec.landmark ?? false,
    });
    if (!lot) dressStop(I, shops, spec, a, pos, rng);
  }
  return pois;
}

const isCurb = (l: Lane, index: LaneIndex): boolean => {
  const ids = l.forward ? index.fwd[l.edge] : index.back[l.edge];
  return ids[ids.length - 1] === l.id;
};

/** give a road-side stop something to stop for: a stall for food stops, the shop sign for the others */
function dressStop(I: PoiInputs, shops: readonly Placement[], spec: PoiSpec, a: Anchor, pos: Vec2, rng: Rng): void {
  const e = I.net.edges[a.lane.edge];
  const F = sideFrame(I.net.nodes, I.net.edges, I.net.bounds, e, a.lane.forward ? 1 : -1);
  const s = (pos.x - F.o.x) * e.dir.x + (pos.z - F.o.z) * e.dir.z;
  if (spec.kind === 'food' || spec.kind === 'market') {
    const cart = foodStall(I.ctx, I.def, F, s, rng, spec.th) ?? foodStall(I.ctx, I.def, F, s + 3, rng, spec.th);
    if (cart?.meta) cart.meta.poi = spec.name;
    if (cart) return;
  }
  let best: { d: number; meta: Record<string, string> } | null = null;
  for (const p of shops) {
    const d = (p.pos.x - pos.x) ** 2 + (p.pos.z - pos.z) ** 2;
    if (d < 144 && p.meta && (!best || d < best.d)) best = { d, meta: p.meta };
  }
  if (best) Object.assign(best.meta, { poi: spec.name, text: spec.th });
}
