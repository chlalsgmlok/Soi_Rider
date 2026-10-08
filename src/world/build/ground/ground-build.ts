import type { BatchedMesh, Material } from 'three';
import type { CityData, OBB, Vec2 } from '../../../core/types';
import { buildBatch, worldItem } from '../kit/batch';
import { ChunkSet } from '../kit/chunk-set';
import { MeshBuilder } from '../kit/mesh-builder';
import type { SpeedBump } from '../types';
import { buildBulbCurbs, buildCurbs } from './curbs';
import type { EdgeSpan } from './edge-spans';
import type { GroundStyle } from './ground-style';
import { buildLotGround } from './lot-ground';
import { buildMedians, type MedianRun } from './median-build';
import { buildNodeSurfaces, buildRoadSurface } from './road-surface';
import { buildBulbVerges, buildSidewalks } from './sidewalks';
import { buildSpeedBumps } from './speed-bumps';

export interface GroundInput {
  data: CityData;
  spans: readonly EdgeSpan[];
  style: GroundStyle;
  bumps: readonly SpeedBump[];
  busStops: readonly Vec2[];
  plazas: readonly OBB[];
  lawns: readonly OBB[];
  medians: readonly MedianRun[];
  material: Material;
}

export interface GroundBuild {
  mesh: BatchedMesh | null;
  chunks: number;
  curbSegments: number;
}

/** Every walkable / drivable surface of the city as chunked geometry in one ground BatchedMesh. */
export function buildGround(I: GroundInput): GroundBuild {
  const { data, style } = I;
  const chunks = new ChunkSet();
  const base = new MeshBuilder();
  buildLotGround(base, I.plazas, I.lawns, chunks, style);
  buildRoadSurface(I.spans, chunks, style);
  buildNodeSurfaces(data.nodes, data.edges, data.bounds, chunks, style);
  buildSidewalks(I.spans, chunks, style);
  buildBulbVerges(data.nodes, data.edges, data.bounds, chunks, style);
  const curbSegments = buildCurbs(I.spans, I.busStops, chunks, style);
  buildBulbCurbs(data.nodes, data.edges, data.bounds, chunks, style);
  buildMedians(I.medians, chunks, style);
  buildSpeedBumps(I.bumps, chunks);
  const builders = chunks.builders();
  const items = [base, ...builders].map((b) => worldItem(b.toGeometry('ground')));
  const batch = buildBatch('city_ground', items, I.material, { castShadow: false, receiveShadow: true });
  return { mesh: batch?.mesh ?? null, chunks: builders.length, curbSegments };
}
