import type { CityData, Lane, RoadEdge, RoadNode, Vec2 } from '../../../core/types';
import { halfWidth } from '../../gen/road-profile';
import { approachGroups, dirFrom } from '../../gen/road-geometry';
import { CROSSWALK_FROM, CROSSWALK_TO } from '../../gen/surface-paint';
import type { ChunkSet } from '../kit/chunk-set';
import { BIKE_BOX_DEPTH } from '../kit/dims';
import { glyph, MARK_Y, stripe } from './decal';
import type { MarkingsAtlas } from './markings-atlas';
import { arrowFor } from './turn-arrows';

interface Approach {
  n: RoadNode;
  e: RoadEdge;
  /** unit direction away from the node along the approach */
  d: Vec2;
  /** lane trim at the node (stop line) */
  t: number;
  hw: number;
  /** arriving lanes and their lateral offset in the approach frame (left of d) */
  arriving: Array<{ lane: Lane; l: number }>;
}

const pt = (A: Approach, s: number, l: number): Vec2 => ({
  x: A.n.pos.x + A.d.x * s + A.d.z * l,
  z: A.n.pos.z + A.d.z * s - A.d.x * l,
});

function approaches(data: CityData, n: RoadNode, trims: Float64Array, byEdge: readonly Lane[][]): Approach[] {
  return n.edges.map((id) => {
    const e = data.edges[id];
    const d = dirFrom(e, n.id);
    const flip = e.a === n.id ? 1 : -1;
    const arriving = byEdge[id]
      .filter((ln) => (ln.forward ? e.b === n.id : e.a === n.id))
      .map((lane) => ({ lane, l: lane.offset * flip }));
    return { n, e, d, t: trims[e.a === n.id ? id * 2 : id * 2 + 1], hw: halfWidth(e), arriving };
  });
}

function span(A: Approach): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const { lane, l } of A.arriving) {
    lo = Math.min(lo, l - lane.width / 2);
    hi = Math.max(hi, l + lane.width / 2);
  }
  return [lo, hi];
}

/** zebra, bike stop line, green motorbike box with pictograms, car stop line, lane arrows */
function signalApproach(A: Approach, data: CityData, chunks: ChunkSet, atlas: MarkingsAtlas): void {
  const white = atlas.rect('white');
  const toward = { x: -A.d.x, z: -A.d.z };
  for (let l = -A.hw + 0.55; l <= A.hw - 0.45; l += 1.0) {
    const c = pt(A, (A.t - CROSSWALK_FROM + A.t - CROSSWALK_TO) / 2, l);
    glyph(chunks, c.x, c.z, A.d.x, A.d.z, 0.5, CROSSWALK_FROM - CROSSWALK_TO - 0.3, white);
  }
  if (A.arriving.length === 0) return;
  const [lo, hi] = span(A);
  stripe(chunks, pt(A, A.t + 0.1, lo), pt(A, A.t + 0.1, hi), 0.2, white);
  const box = pt(A, A.t + 0.2 + (BIKE_BOX_DEPTH - 0.2) / 2, (lo + hi) / 2);
  glyph(chunks, box.x, box.z, toward.x, toward.z, hi - lo, BIKE_BOX_DEPTH - 0.2, atlas.rect('boxfill'));
  stripe(chunks, pt(A, A.t + BIKE_BOX_DEPTH + 0.2, lo), pt(A, A.t + BIKE_BOX_DEPTH + 0.2, hi), 0.4, white);
  for (const { lane, l } of A.arriving) {
    const m = pt(A, A.t + 0.2 + (BIKE_BOX_DEPTH - 0.2) / 2, l);
    glyph(chunks, m.x, m.z, toward.x, toward.z, 1.5, 1.5, atlas.rect('moto'), MARK_Y + 0.003);
    const kind = arrowFor(lane, data.connectors);
    for (const ds of [7.5, 22]) {
      if (ds + 6 > lane.length) continue;
      const a = pt(A, A.t + BIKE_BOX_DEPTH + ds, l);
      glyph(chunks, a.x, a.z, toward.x, toward.z, 1.05, 4.6, atlas.rect(`arrow_${kind}`));
    }
  }
}

/** soi joining a major road: solid stop line + "หยุด" painted before it */
function soiMouth(A: Approach, chunks: ChunkSet, atlas: MarkingsAtlas): void {
  if (A.arriving.length === 0) return;
  const [lo, hi] = span(A);
  stripe(chunks, pt(A, A.t + 0.2, lo), pt(A, A.t + 0.2, hi), 0.35, atlas.rect('white'));
  for (const { lane, l } of A.arriving) {
    const c = pt(A, A.t + 2.9, l);
    glyph(chunks, c.x, c.z, -A.d.x, -A.d.z, Math.min(2.3, lane.width - 0.6), 2.8, atlas.rect('stop'));
  }
}

/** yellow box junction: outline + criss-cross over the crossing area */
function yellowBox(data: CityData, n: RoadNode, chunks: ChunkSet, atlas: MarkingsAtlas): void {
  const groups = approachGroups(data.nodes, data.edges, n.id);
  const axes: Array<{ d: Vec2; hw: number }> = [];
  for (const [id, g] of groups) {
    const e = data.edges[id];
    const cur = axes[g];
    if (!cur) axes[g] = { d: dirFrom(e, n.id), hw: halfWidth(e) };
    else cur.hw = Math.max(cur.hw, halfWidth(e));
  }
  if (axes.length < 2) return;
  const [A, B] = axes;
  const c = (sa: number, sb: number): Vec2 => ({
    x: n.pos.x + A.d.x * sa * B.hw + B.d.x * sb * A.hw, z: n.pos.z + A.d.z * sa * B.hw + B.d.z * sb * A.hw,
  });
  const y = atlas.rect('yellow');
  const k = 0.82;
  const corners = [c(-k, -k), c(k, -k), c(k, k), c(-k, k)];
  for (let i = 0; i < 4; i++) stripe(chunks, corners[i], corners[(i + 1) % 4], 0.15, y);
  stripe(chunks, corners[0], corners[2], 0.15, y);
  stripe(chunks, corners[1], corners[3], 0.15, y);
}

export function buildJunctionMarkings(data: CityData, trims: Float64Array, byEdge: readonly Lane[][], chunks: ChunkSet, atlas: MarkingsAtlas): void {
  for (const n of data.nodes) {
    if (n.edges.length < 3) continue;
    const list = approaches(data, n, trims, byEdge);
    if (n.signal) {
      for (const A of list) signalApproach(A, data, chunks, atlas);
      yellowBox(data, n, chunks, atlas);
      continue;
    }
    const major = list.some((A) => A.e.cls !== 'soi');
    for (const A of list) if (major && A.e.cls === 'soi') soiMouth(A, chunks, atlas);
  }
}
