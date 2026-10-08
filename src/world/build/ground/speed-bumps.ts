import type { Rng } from '../../../core/rng';
import type { CityData } from '../../../core/types';
import { headingOf } from '../../../core/math2d';
import { halfWidth } from '../../gen/road-profile';
import { edgeTrims } from '../../gen/road-geometry';
import type { ChunkSet } from '../kit/chunk-set';
import { at, type GroundFrame } from '../kit/frame-shapes';
import type { P3 } from '../kit/mesh-builder';
import type { SpeedBump } from '../types';
import { G } from './ground-style';

const HL = 0.45;
const HEIGHT = 0.075;
const CLEAR = 11;
const SPAWN_CLEAR = 14;
const SLICES = 6;
const STRIPE = 0.5;
const COLORS = ['#F2C230', '#26262A'] as const;

/** a hump and the soi edge it crosses */
export interface PlacedBump {
  bump: SpeedBump;
  edge: number;
}

/** humps across the soi carriageways, clear of junctions and of the rider's start */
export function placeSpeedBumps(data: CityData, rng: Rng): PlacedBump[] {
  const trims = edgeTrims(data.edges, data.lanes, data.nodes);
  const out: PlacedBump[] = [];
  for (const e of data.edges) {
    if (e.cls !== 'soi') continue;
    const s0 = trims[e.id * 2] + CLEAR;
    const s1 = e.length - trims[e.id * 2 + 1] - CLEAR;
    const room = s1 - s0;
    if (room < 6 || !rng.chance(0.75)) continue;
    const count = room > 70 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const s = s0 + (room * (k + 0.5)) / count + rng.range(-0.15, 0.15) * (room / count);
      const a = data.nodes[e.a].pos;
      const c = { x: a.x + e.dir.x * s, z: a.z + e.dir.z * s };
      if (Math.hypot(c.x - data.spawn.pos.x, c.z - data.spawn.pos.z) < SPAWN_CLEAR) continue;
      out.push({ bump: { obb: { cx: c.x, cz: c.z, hw: halfWidth(e), hl: HL, angle: headingOf(e.dir) }, height: HEIGHT }, edge: e.id });
    }
  }
  return out;
}

const profile = (s: number): number => 0.005 + HEIGHT * 0.5 * (1 + Math.cos((Math.PI * s) / HL));
const slope = (s: number): number => (-HEIGHT * 0.5 * Math.PI * Math.sin((Math.PI * s) / HL)) / HL;

/** yellow / black striped cosine humps (ground chunks) */
export function buildSpeedBumps(bumps: readonly SpeedBump[], chunks: ChunkSet): void {
  for (const b of bumps) {
    const F: GroundFrame = { o: { x: b.obb.cx, z: b.obb.cz }, d: { x: Math.sin(b.obb.angle), z: Math.cos(b.obb.angle) } };
    const mb = chunks.at(b.obb.cx, b.obb.cz);
    const n = Math.max(1, Math.round((2 * b.obb.hw) / STRIPE));
    for (let i = 0; i < n; i++) {
      const l0 = -b.obb.hw + (2 * b.obb.hw * i) / n;
      const l1 = -b.obb.hw + (2 * b.obb.hw * (i + 1)) / n;
      mb.color(COLORS[i % 2]).kind(G.curb);
      for (let j = 0; j < SLICES; j++) {
        const s0 = -HL + (2 * HL * j) / SLICES;
        const s1 = -HL + (2 * HL * (j + 1)) / SLICES;
        const k = slope((s0 + s1) / 2);
        const len = Math.hypot(k, 1);
        const nrm: P3 = [(-k * F.d.x) / len, 1 / len, (-k * F.d.z) / len];
        mb.quad(at(F, s0, l0, profile(s0)), at(F, s1, l0, profile(s1)), at(F, s1, l1, profile(s1)), at(F, s0, l1, profile(s0)), nrm);
      }
    }
  }
}
