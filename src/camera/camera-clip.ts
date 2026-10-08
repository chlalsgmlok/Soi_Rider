import { Vector3 } from 'three';
import { damp } from '../core/math2d';
import { Surface, type SurfaceKind } from '../core/types';

/** What the camera needs from the world to stay out of buildings (CityQuery satisfies it). */
export interface CameraWorld {
  surfaceAt(x: number, z: number): SurfaceKind;
  /** roof height at a point (CityQuery.roofAt); without it every Building cell is assumed FALLBACK_ROOF tall */
  roofAt?(x: number, z: number): number;
  /** underside of an overhead structure (CityQuery.ceilingAt): chase cameras stay below the BTS deck */
  ceilingAt?(x: number, z: number): number;
}

/** assumed block height (m) when the world has no roof map — a 4-storey shophouse */
const FALLBACK_ROOF = 14;
/** keep the boom this far above a roof (m) */
const ROOF_CLEAR = 0.8;
const SAMPLES = 10;
/** a camera this close to a block (m; footprints already include balconies/awnings) is practically touching it */
const NEAR = 1.5;
const RING = 8;
/** keep the lens this far under a ceiling (m) */
const CEILING_GAP = 1.2;
/** "no ceiling": above any chase camera (m) */
const NO_CAP = 60;
const p = new Vector3();

/** roof height of the building under a point (0 = open ground) */
export function roofHeight(world: CameraWorld, x: number, z: number): number {
  if (world.roofAt) return world.roofAt(x, z);
  return world.surfaceAt(x, z) === Surface.Building ? FALLBACK_ROOF : 0;
}

/** true when a point at height y is inside (or skimming) a building volume */
export function insideBuilding(world: CameraWorld, x: number, y: number, z: number): boolean {
  const roof = roofHeight(world, x, z);
  return roof > 0 && y < roof + ROOF_CLEAR;
}

/**
 * Keeps chase cameras out of buildings: walks the boom from the look target to the camera; where it passes
 * inside a building volume (roof heights from CityQuery.roofAt, so 2–3 storey shophouses no longer block a 12 m
 * diorama camera) the boom is shortened to just before it and the camera raised a little. A camera hovering
 * beside a facade taller than itself is lifted just over that roof. The diorama yaw chooser (diorama-yaw.ts)
 * normally keeps the boom over open street, so this is the fallback. Eases in fast and out slowly so it never pops.
 */
export class CameraClip {
  private shorten = 0;
  private raise = 0;
  private cap = NO_CAP;

  reset(): void {
    this.shorten = 0;
    this.raise = 0;
    this.cap = NO_CAP;
  }

  /** adjust `pos` in place (boom from `pivot`) */
  apply(dt: number, world: CameraWorld | null, pivot: Vector3, pos: Vector3): void {
    let wantShorten = 0;
    let wantRaise = 0;
    if (world) {
      for (let i = SAMPLES; i >= 2; i--) {
        const t = i / SAMPLES;
        p.lerpVectors(pivot, pos, t);
        if (insideBuilding(world, p.x, p.y, p.z)) {
          wantShorten = 1 - (t - 1.5 / SAMPLES); // half a step in front of the last free sample
          wantRaise = (1 - t) * 4 + 0.8;
        }
      }
      const facade = this.facadeRoof(world, pos);
      if (facade > 0 && pos.y < facade + 1) wantRaise = Math.max(wantRaise, facade + 1.5 - pos.y);
    }
    const k = (want: number, cur: number): number => damp(want > cur ? 10 : 2.5, dt);
    this.shorten += (wantShorten - this.shorten) * k(wantShorten, this.shorten);
    this.raise += (wantRaise - this.raise) * k(wantRaise, this.raise);
    if (this.shorten > 1e-3 || this.raise > 1e-3) {
      pos.lerp(pivot, Math.min(0.85, this.shorten));
      pos.y += this.raise;
    }
    this.underCeiling(dt, world, pivot, pos);
  }

  /** under the skytrain deck the boom slides beneath it (eased) so the rider is filmed along the street below */
  private underCeiling(dt: number, world: CameraWorld | null, pivot: Vector3, pos: Vector3): void {
    let low = NO_CAP;
    if (world?.ceilingAt) {
      for (let i = 0; i <= 4; i++) {
        p.lerpVectors(pivot, pos, i / 4);
        const c = world.ceilingAt(p.x, p.z);
        if (c > 0) low = Math.min(low, c - CEILING_GAP);
      }
    }
    const want = Math.max(pivot.y + 1.5, low);
    this.cap += (want - this.cap) * damp(want < this.cap ? 6 : 1.8, dt);
    if (this.cap < pos.y) pos.y = this.cap;
  }

  /** tallest roof within NEAR metres of the camera (0 = no building close by) */
  private facadeRoof(world: CameraWorld, pos: Vector3): number {
    let top = 0;
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * Math.PI * 2;
      top = Math.max(top, roofHeight(world, pos.x + Math.cos(a) * NEAR, pos.z + Math.sin(a) * NEAR));
    }
    return top;
  }
}
