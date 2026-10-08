import type { Lane, Vec2 } from '../../../core/types';
import type { ChunkSet } from '../kit/chunk-set';
import { EXIT_EXTENSION, GUTTER_W } from '../kit/dims';
import type { EdgeSpan } from '../ground/edge-spans';
import { dashes, stripe } from './decal';
import type { MarkingsAtlas } from './markings-atlas';

const LINE = 0.12;

/** lanes of every edge (index-aligned with data.edges) */
export function lanesByEdge(lanes: readonly Lane[], edgeCount: number): Lane[][] {
  const out: Lane[][] = Array.from({ length: edgeCount }, () => []);
  for (const l of lanes) out[l.edge].push(l);
  return out;
}

/** s-range covered by the lanes of an edge (lane trims), extended at exits */
export function laneExtent(S: EdgeSpan, lanes: readonly Lane[]): [number, number] {
  const o = S.F.o;
  const d = S.F.d;
  const sOf = (p: Vec2): number => (p.x - o.x) * d.x + (p.z - o.z) * d.z;
  let a = Infinity;
  let b = -Infinity;
  for (const ln of lanes) {
    for (const p of [ln.start, ln.end]) {
      a = Math.min(a, sOf(p));
      b = Math.max(b, sOf(p));
    }
  }
  if (!Number.isFinite(a)) return [0, 0];
  return [S.exitA ? -EXIT_EXTENSION : a, S.exitB ? S.e.length + EXIT_EXTENSION : b];
}

/**
 * Longitudinal paint of an edge: dashed white lane dividers, double yellow centre on avenues, dashed white centre on
 * two-way sois, yellow lines along raised medians, white edge lines on majors, the stall-strip line of one-way sois.
 */
export function buildLaneMarkings(S: EdgeSpan, lanes: readonly Lane[], chunks: ChunkSet, atlas: MarkingsAtlas): void {
  if (lanes.length === 0) return;
  const [s0, s1] = laneExtent(S, lanes);
  if (s1 - s0 < 2) return;
  const { F, e, hw } = S;
  const pt = (s: number, l: number): Vec2 => ({ x: F.o.x + F.d.x * s + F.d.z * l, z: F.o.z + F.d.z * s - F.d.x * l });
  const white = atlas.rect('white');
  const yellow = atlas.rect('yellow');
  const major = e.cls !== 'soi';
  const solid = (l: number, uv: typeof white, w = LINE): void => stripe(chunks, pt(s0, l), pt(s1, l), w, uv);
  const dashed = (l: number, dash: number, period: number): void => dashes(chunks, pt(s0, l), pt(s1, l), LINE, dash, period, white, period - dash);
  for (const sign of [1, -1]) {
    const dir = lanes.filter((ln) => Math.sign(ln.offset) === sign).sort((p, q) => Math.abs(p.offset) - Math.abs(q.offset));
    for (let k = 0; k + 1 < dir.length; k++) dashed((dir[k].offset + dir[k + 1].offset) / 2, 3, major ? 8 : 6);
    if (e.median > 0) solid(sign * (e.median / 2 + 0.3), yellow);
    if (major) solid(sign * (hw - GUTTER_W - 0.18), white, 0.14);
  }
  const fwd = lanes.some((ln) => ln.offset > 0);
  const back = lanes.some((ln) => ln.offset < 0);
  if (fwd && back && e.median <= 0) {
    if (e.cls === 'avenue' || e.cls === 'main') {
      solid(0.11, yellow, 0.1);
      solid(-0.11, yellow, 0.1);
    } else {
      dashed(0, 1.8, 4.5);
    }
  } else if (e.oneWay && lanes.length > 0) {
    const ln = lanes[0];
    const inner = ln.offset - Math.sign(ln.offset) * (ln.width / 2);
    solid(inner, white, 0.12);
  }
}
