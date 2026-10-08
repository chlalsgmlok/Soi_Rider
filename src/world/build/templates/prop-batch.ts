import { type BatchedMesh, type Material, type Matrix4, Vector3 } from 'three';
import type { Placement } from '../../../core/types';
import { type BatchInstance, type BatchItem, buildBatch } from '../kit/batch';
import { instanceParams } from './instance-params';
import { InstanceLod, type LodBands } from './instance-lod';
import { lodBands } from './lod-bands';
import { lowDetailFor } from './low-detail';
import { buildShadowCasters, castsShadow } from './shadow-casters';
import type { PaletteRegistry } from './palette-registry';
import type { TemplateLibrary } from './template-library';

/** a chunk geometry for the batch and how far it stays visible */
export interface ExtraItem {
  item: BatchItem;
  bands: LodBands;
}

export interface PropBatchInput {
  placements: readonly Placement[];
  matrices: readonly Matrix4[];
  templates: TemplateLibrary;
  registry: PaletteRegistry;
  /** extra uber-format items (chunked wires, fences, hedges, lanterns …) */
  extras: readonly ExtraItem[];
  material: Material;
  glassMaterial: Material;
  /** QualitySettings.drawDistance */
  drawDistance: number;
}

export interface PropBatches {
  mesh: BatchedMesh | null;
  glass: BatchedMesh | null;
  /** shadow-only batch (low-detail casters) */
  casters: BatchedMesh | null;
  lod: InstanceLod | null;
  instances: number;
  /** placement index → instance id in `mesh` (−1 when not drawn) */
  instanceOf: Int32Array;
}

const centre = new Vector3();

/**
 * Every placement of the city as an instance of its baked template in ONE BatchedMesh (plus one for glass):
 * per-instance palette tints / shutter state, per-instance frustum culling, distance LOD + culling.
 */
export function buildPropBatches(I: PropBatchInput): PropBatches {
  const byAsset = new Map<string, { inst: BatchInstance[]; idx: number[] }>();
  I.placements.forEach((p, i) => {
    const g = byAsset.get(p.asset) ?? { inst: [], idx: [] };
    byAsset.set(p.asset, g);
    g.inst.push({ matrix: I.matrices[i], params: instanceParams(p, I.registry) });
    g.idx.push(i);
  });
  const items: BatchItem[] = [];
  const glassItems: BatchItem[] = [];
  const casterItems: BatchItem[] = [];
  const slots: Array<{ asset: string; full: number; low: number }> = [];
  for (const [asset, g] of byAsset) {
    const t = I.templates.get(asset);
    const full = items.push({ geometry: t.geometry, instances: g.inst }) - 1;
    const lowGeo = lowDetailFor(t);
    const low = lowGeo ? items.push({ geometry: lowGeo, instances: [] }) - 1 : -1;
    slots.push({ asset, full, low });
    const plain = g.inst.map((x) => ({ matrix: x.matrix }));
    if (t.glass) glassItems.push({ geometry: t.glass, instances: plain });
    if (castsShadow(asset)) casterItems.push({ geometry: lowGeo ?? t.geometry, instances: plain });
  }
  const firstExtra = items.length;
  for (const x of I.extras) {
    items.push(x.item);
    casterItems.push(x.item);
  }
  const main = buildBatch('city_static', items, I.material, { castShadow: false, receiveShadow: true, params: true, sort: true });
  const casters = buildShadowCasters(casterItems);
  const glass = buildBatch('city_glass', glassItems, I.glassMaterial, { castShadow: false, receiveShadow: false });
  if (glass) glass.mesh.renderOrder = 2;
  const instanceOf = new Int32Array(I.placements.length).fill(-1);
  if (!main) return { mesh: null, glass: glass?.mesh ?? null, casters, lod: null, instances: 0, instanceOf };
  const lod = new InstanceLod(main.mesh);
  for (const s of slots) {
    const g = byAsset.get(s.asset);
    if (!g) continue;
    const bands = lodBands(s.asset, I.drawDistance);
    const lowId = s.low >= 0 ? main.geometryIds[s.low] : -1;
    main.instanceIds[s.full].forEach((id, k) => {
      const p = I.placements[g.idx[k]];
      instanceOf[g.idx[k]] = id;
      lod.add(id, p.pos.x, p.pos.z, main.geometryIds[s.full], lowId, bands);
    });
  }
  I.extras.forEach((x, k) => {
    const sphere = x.item.geometry.boundingSphere;
    if (sphere) centre.copy(sphere.center);
    for (const id of main.instanceIds[firstExtra + k]) lod.add(id, centre.x, centre.z, main.geometryIds[firstExtra + k], -1, x.bands);
  });
  return { mesh: main.mesh, glass: glass?.mesh ?? null, casters, lod, instances: I.placements.length, instanceOf };
}
