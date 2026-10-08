import type { OBB } from '../../../core/types';
import { forwardOf } from '../../../core/math2d';
import type { ChunkSet } from '../kit/chunk-set';
import { HEIGHTS } from '../kit/dims';
import { flat, slab } from '../kit/frame-shapes';
import type { MeshBuilder } from '../kit/mesh-builder';
import { G, type GroundStyle } from './ground-style';

/** half size of the ground plane under the whole city and its skyline ring */
const WORLD_HALF = 900;
/** lot courts reach this much further toward their street so no strip of bare ground shows before the sidewalk */
const FRONT_FILL = 0.7;

function obbSlab(mb: MeshBuilder, o: OBB, front: number, y: number, topKind: number, topColor: string, style: GroundStyle): void {
  const F = { o: { x: o.cx, z: o.cz }, d: forwardOf(o.angle) };
  mb.color(topColor).kind(topKind);
  flat(mb, F, -o.hl, o.hl + front, -o.hw, o.hw, y);
  mb.color(style.concrete).kind(G.concrete);
  slab(mb, F, -o.hl, o.hl + front, -o.hw, o.hw, HEIGHTS.lot, y, { top: false });
}

/**
 * Ground beyond the streets: one big back-lot plane (dusty ground / weeds, patterned in the shader), raised paved
 * courts of lots (temples, malls, towers, markets, park paths) and park lawns.
 */
export function buildLotGround(base: MeshBuilder, plazas: readonly OBB[], lawns: readonly OBB[], chunks: ChunkSet, style: GroundStyle): void {
  base.color(style.lot).kind(G.lot);
  flat(base, { o: { x: 0, z: 0 }, d: { x: 0, z: 1 } }, -WORLD_HALF, WORLD_HALF, -WORLD_HALF, WORLD_HALF, HEIGHTS.lot);
  for (const o of lawns) obbSlab(chunks.at(o.cx, o.cz), o, 0, HEIGHTS.lawn, G.lawn, style.lawn, style);
  for (const o of plazas) obbSlab(chunks.at(o.cx, o.cz), o, FRONT_FILL, HEIGHTS.plaza, G.slabs, style.slabs, style);
}
