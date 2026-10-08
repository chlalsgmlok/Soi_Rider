import { RIDE } from '../core/config/bikes';
import type { CollisionKind } from '../core/events';
import { KMH } from '../core/math2d';
import type { OBB, TrafficQuery } from '../core/types';
import { type CollisionBody, type CollisionWorld, type ContactReport, SENSE_RADIUS } from './collision-types';
import { RESPONSES } from './contact-responses';
import { CurbDetector } from './curb-detector';
import { ObstacleScan, type ObstaclePart } from './obstacle-scan';
import { type BandShape, shapeAtBand } from './part-shape';
import { RiderPieces } from './rider-pieces';
import { contactPointCircle, contactPointObb, newPenetration, obbCircleOverlap, obbOverlap, type Penetration } from './sat';

/** a contact must be apart this long (s) before touching the same thing again is reported again */
const REARM = 0.35;

/**
 * Resolves the rider against static colliders, NPC bodies + mirrors (height-aware), motos and pedestrians, and
 * reports curb steps. Pushes the rider out, applies the velocity response (speed loss + yaw kick), shoves motos
 * and pedestrians through `traffic.nudge`, makes the rider fall on heavy impacts and reports each contact once.
 */
export class CollisionSystem {
  private readonly scan = new ObstacleScan();
  private readonly curb = new CurbDetector();
  private readonly pieces = new RiderPieces();
  private readonly lastTouch = new Map<number, number>();
  private readonly hitThisStep = new Set<number>();
  private readonly pen: Penetration = newPenetration();
  private readonly shape: BandShape = { obb: null, circle: null };
  private readonly scratch: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };
  private time = 0;
  private pruned = 0;

  /** forget contact memory (teleports, new run) */
  reset(): void {
    this.lastTouch.clear();
    this.curb.reset();
  }

  resolve(player: CollisionBody, city: CollisionWorld | null, traffic: TrafficQuery | null, dt = 1 / 60): ContactReport[] {
    this.time += dt;
    if (this.time - this.pruned > 2) this.prune();
    const out: ContactReport[] = [];
    if (city) this.curb.step(player, city, out);
    const parts = this.scan.gather(player.state.pos, SENSE_RADIUS, city, traffic);
    this.hitThisStep.clear();
    // two passes settle stacked contacts (rider wedged between a car and a pole)
    for (let pass = 0; pass < 2; pass++) {
      const n = this.pieces.update(player);
      for (const part of parts) {
        for (let i = 0; i < n; i++) {
          const piece = this.pieces.list[i];
          // each rider piece only meets the parts of an obstacle at its own height
          if (!shapeAtBand(part, piece.y0, piece.y1, this.scratch, this.shape)) continue;
          const kind: CollisionKind = part.source === 'ped' ? 'pedestrian'
            : piece.role === 'mirror' || part.role === 'mirror' ? 'mirror' : bodyKind(part);
          this.contact(player, piece.obb, part, kind, traffic, out, piece.slot);
        }
      }
    }
    return out;
  }

  private contact(
    player: CollisionBody, piece: OBB, part: ObstaclePart, kind: CollisionKind, traffic: TrafficQuery | null,
    out: ContactReport[], slot: number,
  ): void {
    const pen = this.shape.obb ? obbOverlap(piece, this.shape.obb, this.pen) : this.shape.circle
      ? obbCircleOverlap(piece, this.shape.circle, this.pen) : null;
    if (!pen) return;
    const s = player.state;
    const res = RESPONSES[kind];
    const nx = pen.normal.x;
    const nz = pen.normal.z;
    player.displace(nx * pen.depth * res.share, nz * pen.depth * res.share);

    const key = (part.key * 2 + (part.role === 'mirror' ? 1 : 0)) * 4 + slot;
    if (this.hitThisStep.has(key)) return;
    this.hitThisStep.add(key);
    const vx = Math.sin(s.heading) * s.speed - part.vx;
    const vz = Math.cos(s.heading) * s.speed - part.vz;
    const closing = -(vx * nx + vz * nz);
    if (closing > 0) player.collide(nx, nz, res);
    if (res.share < 1 && traffic && closing > 0) {
      const push = closing * res.shove;
      traffic.nudge(part.id, { x: -nx * push, z: -nz * push });
    }

    const last = this.lastTouch.get(key);
    this.lastTouch.set(key, this.time);
    if (s.fallen || (last !== undefined && this.time - last < REARM)) return;
    const heavy = res.canFell && closing * KMH > RIDE.fallSpeedKmh;
    const point = { x: 0, z: 0 };
    if (this.shape.obb) contactPointObb(piece, this.shape.obb, point);
    else if (this.shape.circle) contactPointCircle(piece, this.shape.circle, point);
    out.push({ kind, heavy, speedKmh: Math.hypot(vx, vz) * KMH, point, otherId: part.id, key: part.key,
      other: `${part.tag}#${part.id}` });
    if (heavy) player.fall(kind);
  }

  private prune(): void {
    this.pruned = this.time;
    for (const [k, t] of this.lastTouch) if (this.time - t > 2) this.lastTouch.delete(k);
  }
}

function bodyKind(part: ObstaclePart): CollisionKind {
  if (part.source === 'ped') return 'pedestrian';
  if (part.source === 'static') return 'static';
  return part.vehicle === 'moto' ? 'moto' : 'body';
}
