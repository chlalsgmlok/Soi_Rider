import { describe, expect, it } from 'vitest';
import { EMERGENCY_DECEL, idmAccel, type IdmParams, stopAccel } from './idm';

const CAR: IdmParams = { a: 2.0, b: 3.0, T: 1.4, s0: 2.0 };
const DT = 1 / 60;

/** follower behind a leader moving at constant vLead; returns the trace of gaps / speeds / accels */
function follow(v0: number, startGap: number, startV: number, vLead: number, seconds: number) {
  let gap = startGap;
  let v = startV;
  let minGap = Infinity;
  let minAccel = 0;
  for (let t = 0; t < seconds; t += DT) {
    const a = idmAccel(v, v0, gap, v - vLead, CAR);
    minAccel = Math.min(minAccel, a);
    const vn = Math.max(0, v + a * DT);
    gap += (vLead - (v + vn) / 2) * DT;
    v = vn;
    minGap = Math.min(minGap, gap);
  }
  return { gap, v, minGap, minAccel };
}

describe('IDM car-following', () => {
  it('stops behind a standing leader at the jam distance without ever touching it', () => {
    const r = follow(14, 60, 14, 0, 30);
    expect(r.v).toBeLessThan(0.05);
    expect(r.gap).toBeGreaterThan(CAR.s0 - 0.05);
    expect(r.gap).toBeLessThan(CAR.s0 + 0.6);
    expect(r.minGap).toBeGreaterThan(CAR.s0 - 0.05);
    // comfortable approach from 60 m at 50 km/h: never needs emergency braking
    expect(r.minAccel).toBeGreaterThan(-6);
  });

  it('settles at the equilibrium headway s0 + v·T behind a steady leader', () => {
    const r = follow(14, 40, 14, 8, 60);
    expect(r.v).toBeCloseTo(8, 1);
    // IDM equilibrium: s = (s0 + vT) / sqrt(1 − (v/v0)^4)
    const expected = (CAR.s0 + 8 * CAR.T) / Math.sqrt(1 - (8 / 14) ** 4);
    expect(r.gap).toBeCloseTo(expected, 0);
  });

  it('brakes hard but bounded when a leader appears close at speed', () => {
    const a = idmAccel(14, 14, 4, 14, CAR);
    expect(a).toBe(EMERGENCY_DECEL);
    expect(idmAccel(0, 14, Infinity, 0, CAR)).toBeCloseTo(CAR.a, 6);
  });

  it('creeps right up to a stop line (within half a metre)', () => {
    let d = 30;
    let v = 8;
    for (let t = 0; t < 30; t += DT) {
      const a = stopAccel(v, 14, d, CAR);
      const vn = Math.max(0, v + a * DT);
      d -= ((v + vn) / 2) * DT;
      v = vn;
      expect(d).toBeGreaterThan(0);
    }
    expect(v).toBeLessThan(0.05);
    expect(d).toBeLessThan(0.6);
  });
});
