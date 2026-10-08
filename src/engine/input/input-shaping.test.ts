import { describe, expect, it } from 'vitest';
import { axisDeadzone, curve, radialDeadzone, rampToward } from './input-shaping';
import { KEY_STEER_RAMP, KEY_STEER_RELEASE } from './keyboard';

describe('input shaping', () => {
  it('keyboard steering reaches full lock in ~0.15 s, not instantly', () => {
    let s = 0;
    const dt = 1 / 60;
    let t = 0;
    s = rampToward(s, 1, dt, KEY_STEER_RAMP, KEY_STEER_RELEASE);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.2);
    while (s < 1) {
      s = rampToward(s, 1, dt, KEY_STEER_RAMP, KEY_STEER_RELEASE);
      t += dt;
    }
    expect(t + dt).toBeCloseTo(KEY_STEER_RAMP, 1);
  });

  it('a short tap gives partial lock; releasing returns faster than ramping', () => {
    let s = 0;
    for (let i = 0; i < 4; i++) s = rampToward(s, -1, 1 / 60, KEY_STEER_RAMP, KEY_STEER_RELEASE);
    expect(s).toBeLessThan(-0.3);
    expect(s).toBeGreaterThan(-0.6);
    let frames = 0;
    while (s !== 0) {
      s = rampToward(s, 0, 1 / 60, KEY_STEER_RAMP, KEY_STEER_RELEASE);
      frames++;
    }
    expect(frames).toBeLessThan(4);
  });

  it('counter-steer from full right to left uses the fast release rate through centre', () => {
    let s = 1;
    s = rampToward(s, -1, 1 / 60, KEY_STEER_RAMP, KEY_STEER_RELEASE);
    expect(1 - s).toBeCloseTo(1 / 60 / KEY_STEER_RELEASE, 5);
  });

  it('stick deadzone is radial and rescaled to start at 0', () => {
    expect(radialDeadzone(0.1, 0.1, 0.16)).toEqual([0, 0]);
    const [x] = radialDeadzone(0.2, 0, 0.16);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(0.06);
    const [fx] = radialDeadzone(1, 0, 0.16);
    expect(fx).toBeCloseTo(1, 6);
  });

  it('trigger deadzone and response curve keep sign and range', () => {
    expect(axisDeadzone(0.05, 0.06)).toBe(0);
    expect(axisDeadzone(1, 0.06)).toBeCloseTo(1, 6);
    expect(axisDeadzone(-0.53, 0.06)).toBeCloseTo(-0.5, 6);
    expect(curve(-0.5, 2)).toBeCloseTo(-0.25, 6);
    expect(curve(1, 1.35)).toBe(1);
  });
});
