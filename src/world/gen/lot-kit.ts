import type { Frontage, OBB, Placement } from '../../core/types';
import { lotArea, lotBox, lotPoint, obbToMeta, roundObb, type LotFrame } from './lot-frame';
import { ON_GROUND, ON_LOT, type PlaceCtx } from './place-ctx';

/** wall / fence thickness along a lot front (m) */
const FENCE_T = 0.35;

/**
 * Builder helpers working in a lot's own (u across, v depth from the street) coordinates. Collects the plaza
 * rectangles it paints so the lot anchor placement can carry them in meta (see buildSurfaceMap).
 */
export class LotKit {
  private readonly plazas: OBB[] = [];

  constructor(readonly ctx: PlaceCtx, readonly L: LotFrame) {}

  /** pave a rectangle of the lot (only over bare ground) */
  plaza(u0: number, u1: number, v0: number, v1: number): void {
    const o = roundObb(lotBox(this.L, u0, u1, v0, v1));
    this.ctx.claimPlaza(o);
    this.plazas.push(o);
  }

  /** a building footprint u0..u1 × v0..v1; returns its collider id or −1 when it does not fit */
  building(u0: number, u1: number, v0: number, v1: number): number {
    const o = lotBox(this.L, u0, u1, v0, v1);
    if (!this.ctx.buildingFits(o, ON_LOT)) return -1;
    this.ctx.claimBuilding(o);
    this.ctx.occupyObb(o);
    return this.ctx.addCollider({ tag: 'building', obb: o });
  }

  /** footprint-table prop at lot coordinates, heading relative to the lot's street-facing heading */
  prop(asset: string, u: number, v: number, turn = 0, scale = 1, allowed = ON_LOT, meta?: Record<string, string>): Placement | null {
    return this.ctx.prop(asset, lotPoint(this.L, u, v), this.L.heading + turn, allowed, scale, meta);
  }

  /** a free-standing model (no checks), e.g. the landmark building itself once its footprint is claimed */
  model(asset: string, u: number, v: number, scale: number, collider: number | null, meta?: Record<string, string>): Placement {
    return this.ctx.add(asset, lotPoint(this.L, u, v), this.L.heading, { scale, collider, meta });
  }

  /** grass ground trees / bushes scattered on a jittered grid avoiding plazas (ON_GROUND only) */
  scatter(assets: readonly string[], step: number, inset: number): void {
    const { rng } = this.ctx;
    for (let v = inset; v <= this.L.depth - inset; v += step) {
      for (let u = -this.L.width / 2 + inset; u <= this.L.width / 2 - inset; u += step) {
        const a = rng.pick(assets);
        this.prop(a, u + rng.range(-step, step) * 0.3, v + rng.range(-step, step) * 0.3, rng.range(0, 6.28), rng.range(0.85, 1.2), ON_GROUND);
      }
    }
  }

  /**
   * Front wall / fence on the street edge with a gate gap gu0..gu1: barrier colliders + one Frontage per segment
   * (the visual builder draws the wall or railing along it).
   */
  fence(gu0: number, gu1: number, kind: Frontage['kind']): void {
    const half = this.L.width / 2;
    for (const [u0, u1] of [[-half, gu0], [gu1, half]] as const) {
      if (u1 - u0 < 0.8) continue;
      const box = lotBox(this.L, u0, u1, 0.15, 0.15 + FENCE_T);
      if (!this.ctx.lanes.obbClear(box)) continue;
      this.ctx.addCollider({ tag: 'barrier', obb: box });
      this.ctx.occupyObb(box);
      this.ctx.frontages.push({ a: lotPoint(this.L, u0, 0.3), b: lotPoint(this.L, u1, 0.3), heading: this.L.heading, edge: this.L.edge, kind });
    }
  }

  /** street-facing frontage line at depth v (awning / facade line for shops and malls) */
  frontage(u0: number, u1: number, v: number, kind: Frontage['kind']): void {
    this.ctx.frontages.push({ a: lotPoint(this.L, u0, v), b: lotPoint(this.L, u1, v), heading: this.L.heading, edge: this.L.edge, kind });
  }

  /** reserve the whole lot so later stages (back rows, infill) never build on its open ground */
  seal(): void {
    this.ctx.occupyObb(lotArea(this.L));
  }

  /** meta for the lot anchor: lot kind, painted plazas and the whole lot area */
  anchorMeta(kind: string, extra: Record<string, string> = {}): Record<string, string> {
    const meta: Record<string, string> = { lot: kind, area: obbToMeta(lotArea(this.L)), ...extra };
    if (this.plazas.length) meta.plazas = this.plazas.map(obbToMeta).join(';');
    return meta;
  }
}
