import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BIKES } from '../../core/config/bikes';
import { BikePhysics, type RideInput } from '../bike-physics';
import { FLAT_ENV } from '../ride-env';
import { HEAD_LOOK_MAX, headLook } from './head-look';
import { RiderAnimator } from './rider-animator';
import { fakeBodyJoints } from './testing/fake-body';

const DT = 1 / 60;
const input = (steer: number): RideInput => ({ throttle: 0, brake: 0, steer, tuck: false });

/** hold 8 m/s with a fixed steering input for 3 s; returns the bike and the input */
function turning(steer: number): BikePhysics {
  const b = new BikePhysics(BIKES.cub);
  for (let i = 0; i < 3 / DT; i++) {
    b.state.speed = 8;
    b.step(DT, input(steer), FLAT_ENV);
  }
  return b;
}

describe('headLook — the rider looks INTO the turn', () => {
  it('a left turn (yaw + left, steering − = left) turns the face left (+); the two terms add up', () => {
    expect(headLook(0.8, -0.4)).toBeCloseTo(0.36, 6);
    expect(headLook(-0.8, 0.4)).toBeCloseTo(-0.36, 6);
    expect(headLook(0.8, -0.4)).toBeGreaterThan(headLook(0.8, 0));
    expect(headLook(5, -1)).toBe(HEAD_LOOK_MAX);
    expect(headLook(-5, 1)).toBe(-HEAD_LOOK_MAX);
  });

  it('with the real sim signs: a leaning left turn looks left, a right turn looks right', () => {
    const left = turning(-0.5).state;
    expect(left.yawRate).toBeGreaterThan(0.3); // heading grows to the left
    expect(left.lean).toBeLessThan(-0.2); // leaning left
    expect(headLook(left.yawRate, -0.5)).toBeGreaterThan(0.25);
    const right = turning(0.5).state;
    expect(right.lean).toBeGreaterThan(0.2);
    expect(headLook(right.yawRate, 0.5)).toBeLessThan(-0.25);
  });

  it('RiderAnimator turns the head toward the inside of the corner (+Y yaw = left on a rider facing +Z)', () => {
    const j = fakeBodyJoints();
    const anim = new RiderAnimator(j, new Group(), new Group());
    const s = turning(-0.5).state;
    for (let i = 0; i < 60; i++) anim.pose(DT, s, -0.5, new Vector3(0, 0.86, -0.14));
    expect(j.head.rotation.y).toBeGreaterThan(0.25);
    // the face direction (+Z rotated by the head yaw) points to the rider's left, +X
    expect(new Vector3(0, 0, 1).applyEuler(j.head.rotation).x).toBeGreaterThan(0.2);
  });
});
