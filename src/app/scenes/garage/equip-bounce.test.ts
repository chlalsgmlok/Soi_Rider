import { describe, expect, it } from 'vitest';
import { EQUIP_HOP, EQUIP_TIME, EquipBounce, equipPose } from './equip-bounce';

describe('equip bounce', () => {
  it('rests before, after and outside the animation', () => {
    for (const t of [-1, EQUIP_TIME, 5, Infinity, Number.NaN]) {
      expect(equipPose(t)).toEqual({ lift: 0, sy: 1, sxz: 1 });
    }
  });

  it('squashes first, then hops to its peak mid-air, then lands back on the disc', () => {
    expect(equipPose(0.07).sy).toBeCloseTo(0.9, 5);
    expect(equipPose(0.07).lift).toBeCloseTo(0, 5);
    expect(equipPose(0.22).lift).toBeCloseTo(EQUIP_HOP, 5);
    expect(equipPose(0.13).sy).toBeGreaterThan(1);
    expect(equipPose(0.4).lift).toBe(0);
    expect(equipPose(0.38).sy).toBeLessThan(1);
  });

  it('keeps the volume while squashing and stays within sane bounds', () => {
    for (let t = 0; t < EQUIP_TIME; t += 0.01) {
      const p = equipPose(t);
      expect(p.sy * p.sxz * p.sxz).toBeCloseTo(1, 6);
      expect(p.sy).toBeGreaterThan(0.85);
      expect(p.sy).toBeLessThan(1.1);
      expect(p.lift).toBeGreaterThanOrEqual(0);
      expect(p.lift).toBeLessThanOrEqual(EQUIP_HOP + 1e-9);
    }
  });

  it('plays from start() and settles', () => {
    const b = new EquipBounce();
    expect(b.update(0.016).sy).toBe(1);
    b.start();
    let peak = 0;
    for (let i = 0; i < 60; i++) peak = Math.max(peak, b.update(1 / 60).lift);
    expect(peak).toBeGreaterThan(EQUIP_HOP * 0.95);
    expect(b.pose).toEqual({ lift: 0, sy: 1, sxz: 1 });
  });
});
