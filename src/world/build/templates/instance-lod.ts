import type { BatchedMesh } from 'three';

const REFRESH = 0.3;

interface Entry {
  id: number;
  x: number;
  z: number;
  full: number;
  /** low-detail geometry id or −1 */
  low: number;
  lod2: number;
  cull2: number;
  /** 0 hidden, 1 low, 2 full */
  state: number;
}

/** distance bands of one asset class (metres) */
export interface LodBands {
  /** beyond this the low-detail geometry is used (Infinity = never) */
  lod: number;
  /** beyond this the instance is not drawn at all (hidden in the haze) */
  cull: number;
}

/**
 * Distance LOD + culling for the city batch: far shophouses / towers / trees swap to stand-ins, small props and wires
 * drop out beyond their visibility range. Re-evaluated a few times per second; only changes touch the BatchedMesh.
 */
export class InstanceLod {
  private readonly list: Entry[] = [];
  private timer = REFRESH;

  constructor(private readonly mesh: BatchedMesh) {}

  add(id: number, x: number, z: number, full: number, low: number, bands: LodBands): void {
    this.list.push({ id, x, z, full, low, lod2: bands.lod * bands.lod, cull2: bands.cull * bands.cull, state: 2 });
  }

  get count(): number {
    return this.list.length;
  }

  update(dt: number, cam: { x: number; z: number }, force = false): void {
    this.timer += dt;
    if (!force && this.timer < REFRESH) return;
    this.timer = 0;
    for (const e of this.list) {
      const d2 = (e.x - cam.x) ** 2 + (e.z - cam.z) ** 2;
      const state = d2 > e.cull2 ? 0 : e.low >= 0 && d2 > e.lod2 ? 1 : 2;
      if (state === e.state) continue;
      if ((state === 0) !== (e.state === 0)) this.mesh.setVisibleAt(e.id, state !== 0);
      if (state !== 0) this.mesh.setGeometryIdAt(e.id, state === 1 ? e.low : e.full);
      e.state = state;
    }
  }
}
