import { describe, expect, it } from 'vitest';
import { newPose } from '../../../camera';
import { ARC, arcAway, easeInOut, RISE, swoopPose } from './swoop-path';

function poses() {
  const stand = newPose();
  stand.pos.set(3, 3, -6);
  stand.target.set(-1, 1, 1);
  stand.fov = 38;
  stand.tilt = 0.5;
  const high = newPose();
  high.pos.set(4, 26, -16);
  high.target.set(0, 0, 10);
  high.fov = 42;
  high.tilt = 1;
  const ride = newPose();
  ride.pos.set(-3, 12, -10);
  ride.target.set(0, 0.6, 3);
  ride.fov = 36;
  ride.tilt = 1;
  return { stand, high, ride };
}

describe('intro swoop path', () => {
  it('starts on the stand shot, passes the establishing shot and lands exactly on the ride framing', () => {
    const { stand, high, ride } = poses();
    const out = newPose();
    swoopPose(stand, high, ride, 0, out);
    expect(out.pos.distanceTo(stand.pos)).toBeLessThan(1e-9);
    swoopPose(stand, high, ride, RISE, out);
    expect(out.pos.distanceTo(high.pos)).toBeLessThan(1e-9);
    expect(out.fov).toBeCloseTo(42, 9);
    swoopPose(stand, high, ride, 1, out);
    expect(out.pos.distanceTo(ride.pos)).toBeLessThan(1e-9);
    expect(out.target.distanceTo(ride.target)).toBeLessThan(1e-9);
    expect(out.fov).toBeCloseTo(36, 9);
  });

  it('rises first, then only descends, with no jumps along the way', () => {
    const { stand, high, ride } = poses();
    const out = newPose();
    let prevY = -Infinity;
    let prev = stand.pos.clone();
    for (let i = 0; i <= 100; i++) {
      const u = i / 100;
      swoopPose(stand, high, ride, u, out);
      if (u <= RISE) expect(out.pos.y).toBeGreaterThanOrEqual(prevY - 1e-9);
      else expect(out.pos.y).toBeLessThanOrEqual(prevY + 1e-9);
      expect(out.pos.distanceTo(prev)).toBeLessThan(1.6);
      prevY = out.pos.y;
      prev = out.pos.clone();
    }
  });

  it('swoops along a sideways arc instead of a straight line', () => {
    const { stand, high, ride } = poses();
    const out = newPose();
    swoopPose(stand, high, ride, RISE + (1 - RISE) / 2, out);
    const mid = high.pos.clone().lerp(ride.pos, 0.5);
    const off = Math.hypot(out.pos.x - mid.x, out.pos.z - mid.z);
    expect(off).toBeGreaterThan(4);
  });

  it('bulges away from the rider so the camera swings round behind them', () => {
    const { stand, high, ride } = poses();
    const rider = { x: 0, z: 0 };
    const arc = arcAway(high, ride, rider);
    expect(Math.abs(arc)).toBe(ARC);
    const out = newPose();
    swoopPose(stand, high, ride, RISE + (1 - RISE) / 2, out, arc);
    const mid = high.pos.clone().lerp(ride.pos, 0.5);
    expect(Math.hypot(out.pos.x - rider.x, out.pos.z - rider.z)).toBeGreaterThan(Math.hypot(mid.x - rider.x, mid.z - rider.z));
  });

  it('eases in and out', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOut(0.05)).toBeLessThan(0.05);
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
  });
});
