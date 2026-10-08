import {
  type BufferGeometry, DoubleSide, FrontSide, Group, type Material, Mesh, MeshStandardMaterial, type Object3D, type Side,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonify } from '../env/toonify';
import { bucketKey, isColorMergeable, materialKey } from './batch-classify';
import { colorBaked, positionsOnly } from './batch-geometry';
import { isInstancedMesh, isMesh } from './material-guards';
import { buildShadowProxies, type CasterCell } from './shadow-proxy';

const centre = new Vector3();

export interface BatchOptions {
  name?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /**
   * fold plain painted materials (opaque, untextured, not emissive, not runtime-driven) into one vertex-coloured
   * material per roughness/metalness bucket — a street of recoloured shophouses becomes a handful of draws
   */
  mergeColors?: boolean;
  /** draw static casters into the shadow map with a few proxy draws (one per grid cell) instead of one per mesh */
  shadowProxy?: boolean;
  /** grid cell size (m) of the shadow proxies — keeps them frustum-cullable in the shadow pass (default 40) */
  shadowCell?: number;
}

interface Bucket {
  material: Material;
  geoms: BufferGeometry[];
}

function attributeKey(g: BufferGeometry): string {
  return `${Object.keys(g.attributes).sort().join(',')}|${g.index ? 'i' : 'n'}|${Object.keys(g.morphAttributes).length}`;
}

function addCaster(cells: Map<string, CasterCell>, size: number, side: Side, g: BufferGeometry): void {
  g.computeBoundingBox();
  const c = g.boundingBox?.getCenter(centre) ?? centre.set(0, 0, 0);
  const s: Side = side === DoubleSide ? DoubleSide : FrontSide;
  const key = `${s}|${Math.floor(c.x / size)}|${Math.floor(c.z / size)}`;
  let entry = cells.get(key);
  if (!entry) {
    entry = { side: s, geoms: [] };
    cells.set(key, entry);
  }
  entry.geoms.push(positionsOnly(g));
}

function mergedMaterial(src: MeshStandardMaterial): MeshStandardMaterial {
  return toonify(new MeshStandardMaterial({
    name: 'Static_Merged', vertexColors: true, roughness: src.roughness, metalness: src.metalness, side: src.side,
    flatShading: src.flatShading,
  }));
}

function push(map: Map<string, Bucket>, key: string, material: () => Material, g: BufferGeometry): void {
  let b = map.get(key);
  if (!b) {
    b = { material: material(), geoms: [] };
    map.set(key, b);
  }
  b.geoms.push(g);
}

/**
 * Merge every static mesh under `root` into as few meshes as possible (world transforms baked):
 *  - by default one mesh per visually-identical material (contract names kept → `setEmissive(batch, 'Window', …)`)
 *  - `mergeColors`: plain painted surfaces share vertex-coloured materials
 *  - `shadowProxy`: per-batch meshes stop casting; 1–2 proxies draw all casters into the shadow map
 * Multi-material meshes are skipped; InstancedMeshes are reparented as-is. Call once per city chunk so the
 * results stay frustum-cullable.
 */
export function batchStatic(root: Object3D, opts: BatchOptions = {}): Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, Bucket>();
  const casters = new Map<string, CasterCell>();
  const cell = Math.max(4, opts.shadowCell ?? 40);
  const passthrough: Object3D[] = [];
  const castShadow = opts.castShadow ?? true;
  root.traverse((o) => {
    if (isInstancedMesh(o)) {
      passthrough.push(o);
      return;
    }
    if (!isMesh(o) || Array.isArray(o.material) || !o.visible) return;
    const m = o.material;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (opts.shadowProxy && castShadow && o.castShadow) addCaster(casters, cell, m.side, g);
    if (opts.mergeColors && isColorMergeable(m)) {
      push(buckets, `merged#${bucketKey(m)}`, () => mergedMaterial(m), colorBaked(g, m.color));
    } else {
      push(buckets, `${materialKey(m)}#${attributeKey(g)}`, () => m, g);
    }
  });
  const out = new Group();
  out.name = opts.name ?? `${root.name || 'static'}_batched`;
  for (const { material, geoms } of buckets.values()) {
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
    if (!merged) {
      console.warn(`[batchStatic] could not merge ${geoms.length} meshes using "${material.name}"`);
      continue;
    }
    merged.computeBoundingSphere();
    const mesh = new Mesh(merged, material);
    mesh.name = `batch_${material.name}`;
    mesh.castShadow = castShadow && !opts.shadowProxy;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  if (opts.shadowProxy && castShadow) for (const p of buildShadowProxies(casters.values(), out.name)) out.add(p);
  for (const p of passthrough) {
    p.updateMatrixWorld(true);
    p.matrix.copy(p.matrixWorld);
    p.matrix.decompose(p.position, p.quaternion, p.scale);
    out.add(p);
  }
  return out;
}
