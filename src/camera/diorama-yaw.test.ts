import { describe, expect, it } from 'vitest';
import { Surface, type PlayerState, type SurfaceKind } from '../core/types';
import { insideBuilding, type CameraWorld } from './camera-clip';
import { DioramaYaw } from './diorama-yaw';
import { DIORAMA_YAW } from './framings';

/** a straight north-bound soi: open street |x| < halfWidth, a building row of `roof` metres beyond it */
function soi(halfWidth: number, roof: number): CameraWorld {
  const inBlock = (x: number): boolean => Math.abs(x) >= halfWidth;
  return {
    surfaceAt: (x: number): SurfaceKind => (inBlock(x) ? Surface.Building : Surface.Road),
    roofAt: (x: number): number => (inBlock(x) ? roof : 0),
  };
}

function rider(x: number, speed = 6): PlayerState {
  return { pos: { x, z: 0 }, heading: 0, speed } as PlayerState;
}

function settle(y: DioramaYaw, world: CameraWorld, s: PlayerState, seconds: number): number {
  let v = y.value;
  for (let t = 0; t < seconds; t += 1 / 60) v = y.update(1 / 60, world, s, s.heading, 0, false);
  return v;
}

describe('insideBuilding', () => {
  it('lets a 12 m camera pass over a 3-storey shophouse but not a 4-storey one', () => {
    expect(insideBuilding(soi(5, 10.5), 6, 12, 0)).toBe(false);
    expect(insideBuilding(soi(5, 13.5), 6, 12, 0)).toBe(true);
    expect(insideBuilding(soi(5, 13.5), 0, 2, 0)).toBe(false);
  });

  it('falls back to a 14 m block when the world has no roof map', () => {
    const flat: CameraWorld = { surfaceAt: (x) => (Math.abs(x) > 5 ? Surface.Building : Surface.Road) };
    expect(insideBuilding(flat, 6, 13, 0)).toBe(true);
    expect(insideBuilding(flat, 6, 15, 0)).toBe(false);
  });
});

describe('DioramaYaw', () => {
  it('keeps the mockup-03 diagonal on a wide main road', () => {
    const y = new DioramaYaw();
    expect(settle(y, soi(14, 13.5), rider(1.7), 2)).toBeCloseTo(DIORAMA_YAW, 3);
  });

  it('swings toward the street axis in a narrow soi lined with tall rows instead of the blocked diagonal', () => {
    const y = new DioramaYaw();
    // left-hand traffic: a north-bound bike rides at x ≈ +1.5; the −0.3 rad diagonal puts the camera ~3.6 m further
    // toward +X → inside the 13.5 m row at x ≥ 4.5, so the chooser must swing toward the street axis
    const v = settle(y, soi(4.5, 13.5), rider(1.5), 3);
    expect(v).toBeGreaterThan(DIORAMA_YAW + 0.07);
    expect(v).toBeLessThan(0.3);
  });

  it('keeps the diagonal in the same soi when the shophouses are low enough to see over', () => {
    const y = new DioramaYaw();
    expect(settle(y, soi(4.5, 7.5), rider(1.5), 2)).toBeCloseTo(DIORAMA_YAW, 3);
  });

  it('eases instead of snapping and returns to the diagonal only after the road opens up', () => {
    const y = new DioramaYaw();
    const narrow = soi(4.5, 13.5);
    const s = rider(1.5);
    const first = y.update(1 / 60, narrow, s, 0, 0, false);
    expect(Math.abs(first - DIORAMA_YAW)).toBeLessThan(0.06);
    const swung = settle(y, narrow, s, 3);
    const wide = soi(14, 13.5);
    expect(Math.abs(y.update(1 / 60, wide, s, 0, 0, false) - swung)).toBeLessThan(0.02);
    expect(settle(y, wide, s, 3)).toBeCloseTo(DIORAMA_YAW, 2);
  });
});
