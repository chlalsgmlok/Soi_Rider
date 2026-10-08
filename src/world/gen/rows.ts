import type { Placement } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { PlaceCtx } from './place-ctx';
import { sideBox, sidePoint, type SideFrame } from './side-frame';

/** shophouse module: 4 m frontage × 10 m deep (bld_shophouse_*) */
export const MODULE = 4;
export const SHOP_DEPTH = 10;

/** how a row of units looks and behaves */
export interface RowStyle {
  /** a new run of identical units: model + per-unit meta factory + run length */
  run: () => { asset: string; meta: () => Record<string, string>; length: number };
  /** chance of an alley / gap between two units */
  gap: number;
  /** record a 'shophouse' Frontage per contiguous row (street rows: awnings, shade) */
  frontage: boolean;
  /** how far to slide along after a unit does not fit (fine for street rows, coarse for back rows) */
  probe: number;
}

/**
 * Lay a row of 4 m units along a road side from s0 to s1 with facades `d0` metres out from the centreline,
 * wherever the 10 m deep footprint is free. Contiguous units share one building collider (and one Frontage when
 * the style asks for it). Returns the number of units placed.
 */
export function buildRows(ctx: PlaceCtx, F: SideFrame, s0: number, s1: number, d0: number, style: RowStyle, rng: Rng): number {
  let run = style.run();
  let left = run.length;
  let row: { s0: number; mods: Placement[] } | null = null;
  let placed = 0;
  const close = (end: number): void => {
    if (!row) return;
    const collider = ctx.addCollider({ tag: 'building', obb: sideBox(F, row.s0, end, d0, d0 + SHOP_DEPTH) });
    for (const p of row.mods) p.collider = collider;
    if (style.frontage) {
      ctx.frontages.push({ a: sidePoint(F, row.s0, d0), b: sidePoint(F, end, d0), heading: F.facing, edge: F.e.id, kind: 'shophouse' });
    }
    row = null;
  };
  let s = s0;
  while (s + MODULE <= s1 + 0.01) {
    if (row && rng.chance(style.gap)) {
      close(s);
      s += MODULE;
      continue;
    }
    const box = sideBox(F, s, s + MODULE, d0, d0 + SHOP_DEPTH);
    if (!ctx.buildingFits(box)) {
      close(s);
      s += style.probe;
      continue;
    }
    ctx.claimBuilding(box);
    if (left-- <= 0) {
      run = style.run();
      left = run.length - 1;
    }
    const p = ctx.add(run.asset, sidePoint(F, s + MODULE / 2, d0), F.facing, { meta: run.meta() });
    if (!row) row = { s0: s, mods: [] };
    row.mods.push(p);
    placed++;
    s += MODULE;
  }
  close(s);
  return placed;
}
