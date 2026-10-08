import type { Bounds2, OBB, Vec2 } from '../../core/types';
import { headingOf } from '../../core/math2d';
import { sideBox, type SideFrame } from './side-frame';

/**
 * A rectangular lot facing a street. u = across the frontage (along the model right axis of `heading`),
 * v = depth measured from the front edge (0 = street side, depth = back).
 */
export interface LotFrame {
  c: Vec2;
  /** unit vector from the lot toward its street */
  f: Vec2;
  heading: number;
  width: number;
  depth: number;
  /** road edge the lot fronts (−1 unknown) */
  edge: number;
}

export function lotPoint(L: LotFrame, u: number, v: number): Vec2 {
  const k = L.depth / 2 - v;
  return { x: L.c.x + L.f.x * k - L.f.z * u, z: L.c.z + L.f.z * k + L.f.x * u };
}

export function lotBox(L: LotFrame, u0: number, u1: number, v0: number, v1: number): OBB {
  const p = lotPoint(L, (u0 + u1) / 2, (v0 + v1) / 2);
  return { cx: p.x, cz: p.z, hw: Math.abs(u1 - u0) / 2, hl: Math.abs(v1 - v0) / 2, angle: L.heading };
}

export const lotArea = (L: LotFrame): OBB => lotBox(L, -L.width / 2, L.width / 2, 0, L.depth);

/** lot from an axis-aligned reserve rectangle and its facing axis */
export function lotFromRect(rect: Bounds2, facing: Vec2, edge: number): LotFrame {
  const alongX = Math.abs(facing.x) < 0.5;
  const w = rect.maxX - rect.minX;
  const h = rect.maxZ - rect.minZ;
  return {
    c: { x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 }, f: facing, heading: headingOf(facing),
    width: alongX ? w : h, depth: alongX ? h : w, edge,
  };
}

/** lot on one side of a road edge spanning s0..s1 along it and d0..d1 out from the centreline */
export function lotFromSide(F: SideFrame, s0: number, s1: number, d0: number, d1: number): LotFrame {
  const b = sideBox(F, s0, s1, d0, d1);
  return {
    c: { x: b.cx, z: b.cz }, f: { x: Math.sin(F.facing), z: Math.cos(F.facing) }, heading: F.facing,
    width: s1 - s0, depth: d1 - d0, edge: F.e.id,
  };
}

const r2 = (v: number): string => (Math.round(v * 100) / 100).toString();

/** "cx,cz,hw,hl,angle" — OBBs travel through Placement.meta as strings */
export const obbToMeta = (o: OBB): string => [o.cx, o.cz, o.hw, o.hl, o.angle].map(r2).join(',');

export function obbFromMeta(s: string): OBB | null {
  const v = s.split(',').map(Number);
  if (v.length !== 5 || v.some((n) => !Number.isFinite(n))) return null;
  return { cx: v[0], cz: v[1], hw: v[2], hl: v[3], angle: v[4] };
}

/** the OBB list a lot anchor paints as Plaza (meta.plazas = "obb;obb;…") */
export function plazasFromMeta(meta: Record<string, string> | undefined): OBB[] {
  if (!meta?.plazas) return [];
  return meta.plazas.split(';').map(obbFromMeta).filter((o): o is OBB => o !== null);
}

/** an OBB exactly as it will read back from meta (generation paints this so rebuilds match bit for bit) */
export const roundObb = (o: OBB): OBB => obbFromMeta(obbToMeta(o)) as OBB;
