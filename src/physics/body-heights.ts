import type { ColliderTag, VehicleKind } from '../core/types';

/**
 * Vertical profiles for height-aware contacts. Cars are full width only up to the belt line; above it the glass
 * house is narrower by `tumble` per side, so a scooter mirror (≈1.12 m) can slide past a sedan's flank that its
 * bars could not. Values follow the GLB silhouettes in public/assets/models (docs/ASSET_SPEC.md sizes).
 */
export interface HeightProfile {
  /** top of the body (m) */
  height: number;
  /** belt line (m): above it the body is `tumble` narrower on each side */
  beltY: number;
  tumble: number;
}

export const VEHICLE_HEIGHTS: Readonly<Record<VehicleKind, HeightProfile>> = {
  taxi: { height: 1.5, beltY: 0.95, tumble: 0.14 },
  sedan: { height: 1.45, beltY: 0.93, tumble: 0.14 },
  van: { height: 2.25, beltY: 1.05, tumble: 0.05 },
  pickup: { height: 1.8, beltY: 1.0, tumble: 0.1 },
  tuktuk: { height: 1.9, beltY: 0.85, tumble: 0.04 },
  bus: { height: 3.2, beltY: 1.2, tumble: 0.02 },
  songthaew: { height: 2.2, beltY: 1.05, tumble: 0.03 },
  moto: { height: 1.7, beltY: 1.0, tumble: 0.12 },
};

/** static collider tops: low things (barriers, stools, median curbs) pass under a mirror */
export const STATIC_HEIGHTS: Readonly<Record<ColliderTag, number>> = {
  building: 12,
  pole: 9,
  tree: 6,
  cart: 1.6,
  pillar: 9.5,
  barrier: 0.85,
  median: 0.3,
  furniture: 0.8,
};

export const PEDESTRIAN_HEIGHT = 1.68;

/** do two vertical ranges overlap (strictly)? */
export const rangesOverlap = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

/** width lost per side at height band [y0, y1] (only when the whole band is above the belt line) */
export const tumbleAt = (p: HeightProfile, y0: number): number => (y0 >= p.beltY ? p.tumble : 0);
