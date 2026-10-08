import { type BatchedMesh, MeshStandardMaterial } from 'three';
import type { Rng } from '../../../core/rng';
import type { Circle, CityData } from '../../../core/types';
import { toonify } from '../../../engine/env/toonify';
import { edgeTrims } from '../../gen/road-geometry';
import type { EdgeSpan } from '../ground/edge-spans';
import type { PlacedBump } from '../ground/speed-bumps';
import { buildBatch, worldItem } from '../kit/batch';
import { ChunkSet } from '../kit/chunk-set';
import { glyph } from './decal';
import { buildJunctionMarkings } from './junction-markings';
import { buildLaneMarkings, lanesByEdge } from './lane-markings';
import { MarkingsAtlas } from './markings-atlas';
import { buildRoadDecals } from './road-decals';

export interface Markings {
  mesh: BatchedMesh | null;
  puddleSpots: Circle[];
  setWet(w: number): void;
  dispose(): void;
}

/** "ช้าลง" (slow down) painted in each lane 7 m before every hump */
function bumpWarnings(data: CityData, bumps: readonly PlacedBump[], chunks: ChunkSet, atlas: MarkingsAtlas): void {
  for (const { bump, edge } of bumps) {
    for (const ln of data.lanes) {
      if (ln.edge !== edge) continue;
      const along = (bump.obb.cx - ln.start.x) * ln.dir.x + (bump.obb.cz - ln.start.z) * ln.dir.z;
      const s = along - 7;
      if (s < 1) continue;
      glyph(chunks, ln.start.x + ln.dir.x * s, ln.start.z + ln.dir.z * s, ln.dir.x, ln.dir.z, Math.min(2.2, ln.width - 0.7), 2.6, atlas.rect('slow'));
    }
  }
}

/**
 * All painted road markings and asphalt decals, chunked, in one transparent BatchedMesh drawn over the ground
 * (creation order = paint order: stains and covers first, lines, then words and arrows on top).
 */
export function buildMarkings(data: CityData, spans: readonly EdgeSpan[], bumps: readonly PlacedBump[], rng: Rng): Markings {
  const atlas = new MarkingsAtlas();
  const chunks = new ChunkSet();
  const byEdge = lanesByEdge(data.lanes, data.edges.length);
  const puddleSpots = buildRoadDecals(data, spans, byEdge, chunks, atlas, rng);
  for (const S of spans) buildLaneMarkings(S, byEdge[S.e.id], chunks, atlas);
  buildJunctionMarkings(data, edgeTrims(data.edges, data.lanes, data.nodes), byEdge, chunks, atlas);
  bumpWarnings(data, bumps, chunks, atlas);
  const material = toonify(new MeshStandardMaterial({
    name: 'City_Markings', map: atlas.texture, transparent: true, depthWrite: false, roughness: 0.62, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }));
  const batch = buildBatch('city_markings', chunks.builders().map((b) => worldItem(b.toGeometry('decal'))), material, { receiveShadow: true });
  if (batch) batch.mesh.renderOrder = 1;
  return {
    mesh: batch?.mesh ?? null,
    puddleSpots,
    setWet(w: number): void {
      material.roughness = 0.62 - 0.45 * w;
      material.color.setScalar(1 - 0.25 * w);
    },
    dispose(): void {
      batch?.mesh.dispose();
      material.dispose();
      atlas.dispose();
    },
  };
}
