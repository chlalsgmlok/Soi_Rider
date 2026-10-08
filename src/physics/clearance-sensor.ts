import type { ClearanceInfo, OBB, TrafficQuery, Vec2 } from '../core/types';
import type { CollisionWorld, SensedRider } from './collision-types';
import { newGapPoints, obbCircleGap, obbGap } from './obb-gap';
import { ObstacleScan, type ObstaclePart, type PartSource } from './obstacle-scan';
import { type BandShape, shapeAtBand } from './part-shape';
import { RiderPieces } from './rider-pieces';

/** gaps beyond this are "open" (Infinity) */
export const CLEARANCE_RANGE = 1.5;
/** only obstacles whose closest point lies within ±this along the bike count as beside it */
export const CLEARANCE_WINDOW = 1.5;

/** Closest gap to one obstacle on one side this step (for the style sensor). */
export interface ClearanceSample {
  key: number;
  id: number;
  source: PartSource;
  /** −1 = left, +1 = right */
  side: -1 | 1;
  gap: number;
  /** closest point's offset along the bike (+ = ahead) */
  along: number;
  point: Vec2;
}

/**
 * Left/right free space between the rider and the nearest obstacles — at mirror height (mirror heads vs mirrors
 * and tall bodies) and at body height (hull vs bodies, low mirrors, people, poles) — within ±1.5 m along the bike.
 */
export class ClearanceSensor {
  readonly info: ClearanceInfo = { left: Infinity, right: Infinity, leftPoint: null, rightPoint: null, leftId: -1, rightId: -1 };
  /** one entry per (obstacle, side) seen this step; valid until the next `sense` */
  readonly samples: ClearanceSample[] = [];
  private readonly pool: ClearanceSample[] = [];
  private readonly scan = new ObstacleScan();
  private readonly pieces = new RiderPieces();
  private readonly shape: BandShape = { obb: null, circle: null };
  private readonly scratch: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };
  private readonly gp = newGapPoints();
  private readonly leftPt: Vec2 = { x: 0, z: 0 };
  private readonly rightPt: Vec2 = { x: 0, z: 0 };

  sense(rider: SensedRider, city: CollisionWorld | null, traffic: TrafficQuery | null): ClearanceInfo {
    const s = rider.state;
    const info = this.info;
    info.left = Infinity;
    info.right = Infinity;
    info.leftId = -1;
    info.rightId = -1;
    for (const smp of this.samples) this.pool.push(smp);
    this.samples.length = 0;
    const reach = CLEARANCE_RANGE + CLEARANCE_WINDOW + s.obb.hl;
    const n = this.pieces.update(rider);
    for (const part of this.scan.gather(s.pos, reach, city, traffic)) {
      for (let i = 0; i < n; i++) {
        const piece = this.pieces.list[i];
        if (shapeAtBand(part, piece.y0, piece.y1, this.scratch, this.shape)) this.measure(rider, piece.obb, part);
      }
    }
    info.leftPoint = info.leftId >= 0 ? this.leftPt : null;
    info.rightPoint = info.rightId >= 0 ? this.rightPt : null;
    return info;
  }

  private measure(rider: SensedRider, piece: OBB, part: ObstaclePart): void {
    const { obb, circle } = this.shape;
    const gap = obb ? obbGap(piece, obb, this.gp) : circle ? obbCircleGap(piece, circle, this.gp) : Infinity;
    if (!(gap <= CLEARANCE_RANGE)) return;
    const s = rider.state;
    const p = this.gp.onB;
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const dx = p.x - s.pos.x;
    const dz = p.z - s.pos.z;
    const along = dx * fx + dz * fz;
    const lateral = -dx * fz + dz * fx; // + = right (rightOf(θ) = (−cos θ, sin θ))
    if (Math.abs(along) > CLEARANCE_WINDOW || Math.abs(lateral) < s.obb.hw * 0.5) return;
    const side: -1 | 1 = lateral > 0 ? 1 : -1;
    this.record(part, side, gap, along, p);
    const info = this.info;
    if (side < 0 && gap < info.left) {
      info.left = gap;
      info.leftId = part.key;
      this.leftPt.x = p.x;
      this.leftPt.z = p.z;
    } else if (side > 0 && gap < info.right) {
      info.right = gap;
      info.rightId = part.key;
      this.rightPt.x = p.x;
      this.rightPt.z = p.z;
    }
  }

  private record(part: ObstaclePart, side: -1 | 1, gap: number, along: number, p: Vec2): void {
    for (const smp of this.samples) {
      if (smp.key !== part.key || smp.side !== side) continue;
      if (gap < smp.gap) {
        smp.gap = gap;
        smp.along = along;
        smp.point.x = p.x;
        smp.point.z = p.z;
      }
      return;
    }
    const smp = this.pool.pop() ?? { key: 0, id: 0, source: 'static', side: 1, gap: 0, along: 0, point: { x: 0, z: 0 } };
    smp.key = part.key;
    smp.id = part.id;
    smp.source = part.source;
    smp.side = side;
    smp.gap = gap;
    smp.along = along;
    smp.point.x = p.x;
    smp.point.z = p.z;
    this.samples.push(smp);
  }
}
