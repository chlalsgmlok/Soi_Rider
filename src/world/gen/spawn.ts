import type { Lane, RoadEdge, Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { headingOf } from '../../core/math2d';
import type { DistrictDef } from './district-types';
import type { LaneIndex } from './lanes';
import type { RoadNet } from './net-types';
import { ON_VERGE, type PlaceCtx } from './place-ctx';
import { sideFrame, sidePoint } from './side-frame';
import { foodStall } from './street-food';

export interface SpawnSite {
  pos: Vec2;
  heading: number;
  lane: number;
  /** soi edge the stand is on */
  edge: number;
}

/** stop point inside a lane, toward its curb side (left of travel), `s` metres from the lane start */
export function curbPoint(l: Lane, s: number): Vec2 {
  const k = l.width * 0.22;
  return { x: l.start.x + l.dir.x * s + l.dir.z * k, z: l.start.z + l.dir.z * s - l.dir.x * k };
}

/** the home soi's edge at its mouth onto the parent road, and that mouth node */
function homeMouth(net: RoadNet, spawnLine: number): { e: RoadEdge; node: number } | null {
  const parent = spawnLine >= 0 ? net.lines[spawnLine].parent : -1;
  const isMouth = (e: RoadEdge, n: number): boolean =>
    net.nodes[n].edges.length >= 3 && net.nodes[n].edges.some((id) => id !== e.id && (parent < 0 ? net.edges[id].cls !== 'soi' : net.edgeLine[id] === parent));
  const pool = net.edges.filter((e) => (spawnLine >= 0 ? net.edgeLine[e.id] === spawnLine : e.cls === 'soi') && !e.oneWay && e.length > 30);
  for (const e of pool) for (const n of [e.a, e.b]) if (isMouth(e, n)) return { e, node: n };
  return spawnLine >= 0 ? homeMouth(net, -1) : null;
}

/**
 * The rider's win stand on the home soi a short way in from its mouth: the stand on the sidewalk, Lek's
 * khao man gai stall next to it (meta.story = 'lek'), and the spawn point in the outbound curb lane beside them,
 * facing the main road.
 */
export function placeSpawn(net: RoadNet, lanes: readonly Lane[], index: LaneIndex, ctx: PlaceCtx, def: DistrictDef, spawnLine: number, rng: Rng): SpawnSite | null {
  const home = homeMouth(net, spawnLine);
  if (!home) return null;
  const { e, node } = home;
  const out = e.b === node ? index.fwd[e.id] : index.back[e.id];
  if (out.length === 0) return null;
  const lane = lanes[out[out.length - 1]];
  const s = Math.max(lane.length * 0.4, lane.length - rng.range(14, 18));
  const pos = curbPoint(lane, s);
  const F = sideFrame(net.nodes, net.edges, net.bounds, e, lane.forward ? 1 : -1);
  const sEdge = (pos.x - F.o.x) * e.dir.x + (pos.z - F.o.z) * e.dir.z;
  const toMouth = lane.forward ? 1 : -1;
  const site = { pos, heading: headingOf(lane.dir), lane: lane.id, edge: e.id };
  for (const k of [0, -1.5, 1.5, -3, 3]) {
    const meta = { text: 'วิน', soi: e.nameTh, number: String(def.roads.spawn.number), home: '1' };
    if (!ctx.prop('prop_win_stand', sidePoint(F, sEdge + k, F.bl - 0.95), F.facing, ON_VERGE, 1, meta)) continue;
    const cart = foodStall(ctx, def, F, sEdge + k + toMouth * 3.6, rng, 'ข้าวมันไก่');
    if (cart?.meta) cart.meta.story = 'lek';
    break;
  }
  return site;
}
