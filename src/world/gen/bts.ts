import type { RoadEdge, Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { headingOf } from '../../core/math2d';
import type { RoadNet } from './net-types';
import { ON_MEDIAN, type PlaceCtx } from './place-ctx';

/** viaduct deck segment length (bts_deck is authored 40 m long) */
export const DECK_LEN = 40;
/** station box length along the line */
export const STATION_LEN = 60;
/** pillar collider: across the road (fits inside the 2.4 m median) × along it */
const PILLAR_W = 2.2;
const PILLAR_L = 3.6;

export interface BtsLine {
  /** origin and unit direction of the (straight) skytrain line */
  o: Vec2;
  dir: Vec2;
  edges: RoadEdge[];
  /** station centre as distance along the line (NaN if none) */
  station: number;
}

const at = (L: { o: Vec2; dir: Vec2 }, s: number): Vec2 => ({ x: L.o.x + L.dir.x * s, z: L.o.z + L.dir.z * s });

/**
 * BTS viaduct over the skytrain main road: 40 m deck segments end to end from boundary to boundary, a T-pillar at
 * every deck joint that lands on the median (joints inside junction boxes are spanned), and one elevated station
 * near `target` (the landmark corner), clear of signalised junction boxes.
 */
export function placeBts(net: RoadNet, ctx: PlaceCtx, rng: Rng, target: Vec2): BtsLine | null {
  const edges = net.edges.filter((e) => e.skytrain);
  if (edges.length === 0) return null;
  const d0 = edges[0].dir;
  const dir = Math.abs(d0.x) >= Math.abs(d0.z) ? { x: Math.sign(d0.x), z: 0 } : { x: 0, z: Math.sign(d0.z) };
  const o = net.nodes[edges[0].a].pos;
  const L = { o: { x: dir.x !== 0 ? 0 : o.x, z: dir.z !== 0 ? 0 : o.z }, dir };
  const heading = headingOf(dir);
  const half = Math.max(net.bounds.maxX - net.bounds.minX, net.bounds.maxZ - net.bounds.minZ) / 2;
  const pillarAt = (s: number) => {
    const p = at(L, s);
    return { cx: p.x, cz: p.z, hw: PILLAR_W / 2, hl: PILLAR_L / 2, angle: heading };
  };
  const ok = (s: number): boolean => ctx.obbFree(pillarAt(s), ON_MEDIAN) && ctx.lanes.obbClear(pillarAt(s));
  let phase = 0;
  let bestBad = Infinity;
  const start = rng.int(0, DECK_LEN - 1);
  for (let k = 0; k < DECK_LEN; k += 2) {
    const ph = (start + k) % DECK_LEN;
    let bad = 0;
    for (let s = -half + ph; s <= half; s += DECK_LEN) if (!ok(s)) bad++;
    if (bad < bestBad) [bestBad, phase] = [bad, ph];
  }
  for (let s = -half - DECK_LEN + phase; s <= half + DECK_LEN; s += DECK_LEN) {
    ctx.add('bts_deck', at(L, s + DECK_LEN / 2), heading);
    if (s < -half || s > half || !ok(s)) continue;
    const box = pillarAt(s);
    ctx.occupyObb(box, 0.4);
    ctx.add('bts_pillar', at(L, s), heading, { collider: ctx.addCollider({ tag: 'pillar', obb: box }) });
  }
  const station = pickStation(net, L, target, half);
  if (!Number.isNaN(station)) ctx.add('bts_station', at(L, station), heading, { meta: { name: 'station' } });
  return { o: L.o, dir, edges, station };
}

/** station centre along the line: nearest to the target while its span stays clear of signalised boxes */
function pickStation(net: RoadNet, L: { o: Vec2; dir: Vec2 }, target: Vec2, half: number): number {
  const proj = (p: Vec2): number => (p.x - L.o.x) * L.dir.x + (p.z - L.o.z) * L.dir.z;
  const off = (p: Vec2): number => Math.abs((p.x - L.o.x) * L.dir.z - (p.z - L.o.z) * L.dir.x);
  const blocks = net.nodes.filter((n) => n.signal && off(n.pos) < 2).map((n) => [proj(n.pos), n.radius] as const);
  const want = proj(target);
  let best = NaN;
  for (let s = -half + STATION_LEN / 2 + 10; s <= half - STATION_LEN / 2 - 10; s += 2) {
    const clear = blocks.every(([c, r]) => Math.abs(s - c) >= STATION_LEN / 2 + r + 2);
    if (clear && (Number.isNaN(best) || Math.abs(s - want) < Math.abs(best - want))) best = s;
  }
  return best;
}
