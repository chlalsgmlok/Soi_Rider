import type { Bounds2, Lane, OBB } from '../../core/types';
import { GridIndex } from './grid-index';
import { laneObb, obbAabb, obbIntersects, pointObbDist } from './obb-math';

/**
 * Exact "does this solid footprint touch a lane rectangle?" queries used while placing colliders, so no static
 * collider ever intrudes into a lane (the raster alone is only accurate to half a cell).
 */
export class LaneClearance {
  private readonly grid: GridIndex;
  private readonly boxes: OBB[];
  private readonly box4: [number, number, number, number] = [0, 0, 0, 0];

  constructor(bounds: Bounds2, lanes: readonly Lane[]) {
    this.boxes = lanes.map(laneObb);
    this.grid = new GridIndex(bounds, 8, lanes.length);
    this.boxes.forEach((b, i) => {
      const [x0, z0, x1, z1] = obbAabb(b);
      this.grid.insert(i, x0, z0, x1, z1);
    });
    this.grid.finalize();
  }

  /** circle keeps at least `gap` metres from every lane */
  circleClear(cx: number, cz: number, r: number, gap = 0.05): boolean {
    const reach = r + gap;
    const n = this.grid.collect(cx - reach, cz - reach, cx + reach, cz + reach);
    for (let i = 0; i < n; i++) if (pointObbDist(cx, cz, this.boxes[this.grid.out[i]]) < reach) return false;
    return true;
  }

  obbClear(o: OBB, gap = 0.05): boolean {
    const [x0, z0, x1, z1] = obbAabb(o, this.box4);
    const n = this.grid.collect(x0 - gap, z0 - gap, x1 + gap, z1 + gap);
    for (let i = 0; i < n; i++) if (obbIntersects(o, this.boxes[this.grid.out[i]], gap)) return false;
    return true;
  }
}
