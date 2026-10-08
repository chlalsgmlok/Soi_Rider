import { BatchedMesh, type BufferGeometry, type Material, Matrix4, Vector4 } from 'three';

export interface BatchInstance {
  matrix: Matrix4;
  /** per-instance vec4 read by the city shaders (palette indices, shutter state + seed); omitted = zeros */
  params?: Vector4;
}

export interface BatchItem {
  geometry: BufferGeometry;
  instances: BatchInstance[];
}

export interface BatchOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** write per-instance params into the batching colour texture */
  params?: boolean;
  /** opaque front-to-back sorting (cuts overdraw of dense streets) */
  sort?: boolean;
}

export interface BatchResult {
  mesh: BatchedMesh;
  /** geometry id per item (same order as the input) */
  geometryIds: number[];
  /** instance ids per item */
  instanceIds: number[][];
}

const IDENTITY = new Matrix4();
const ZERO = new Vector4();

/** a single world-space piece (chunk geometry) placed with an identity matrix */
export const worldItem = (geometry: BufferGeometry): BatchItem => ({ geometry, instances: [{ matrix: IDENTITY }] });

/**
 * One BatchedMesh for many geometries and their instances: a single multi-draw call, per-instance frustum culling
 * (main + shadow pass) and per-instance params. Template geometries are stored once however many instances use them;
 * items without instances still add their geometry (LOD variants swapped in later with setGeometryIdAt).
 * Returns null when there is nothing to draw.
 */
export function buildBatch(name: string, items: readonly BatchItem[], material: Material, opts: BatchOptions = {}): BatchResult | null {
  const used = new Set(items.filter((it) => it.geometry.getAttribute('position').count > 0));
  if (used.size === 0) return null;
  let verts = 0;
  let index = 0;
  let instances = 0;
  for (const it of used) {
    verts += it.geometry.getAttribute('position').count;
    index += it.geometry.getIndex()?.count ?? 0;
    instances += Math.max(1, it.instances.length);
  }
  const mesh = new BatchedMesh(instances, verts, index, material);
  mesh.name = name;
  mesh.castShadow = opts.castShadow ?? false;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  mesh.sortObjects = opts.sort ?? false;
  mesh.perObjectFrustumCulled = true;
  const geometryIds: number[] = [];
  const instanceIds: number[][] = [];
  for (const it of items) {
    if (!used.has(it)) {
      geometryIds.push(-1);
      instanceIds.push([]);
      continue;
    }
    const gid = mesh.addGeometry(it.geometry);
    geometryIds.push(gid);
    const ids: number[] = [];
    for (const inst of it.instances) {
      const id = mesh.addInstance(gid);
      mesh.setMatrixAt(id, inst.matrix);
      if (opts.params) mesh.setColorAt(id, inst.params ?? ZERO);
      ids.push(id);
    }
    instanceIds.push(ids);
  }
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return { mesh, geometryIds, instanceIds };
}
