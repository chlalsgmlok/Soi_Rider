import { describe, expect, it } from 'vitest';
import { BIKES, RIDE } from '../core/config/bikes';
import { EventBus } from '../core/events';
import { G, wrapAngle } from '../core/math2d';
import { BikePhysics, type RideInput } from './bike-physics';
import { FLAT_ENV, gripFor, type RideEnv } from './ride-env';
import { maxSteerAt } from './ride-steering';

const DT = 1 / 60;
const WET: RideEnv = { ...FLAT_ENV, grip: RIDE.gripWet };
const input = (p: Partial<RideInput>): RideInput => ({ throttle: 0, brake: 0, steer: 0, tuck: false, ...p });

function stoppingDistance(env: RideEnv, kmh = 40): number {
  const b = new BikePhysics(BIKES.cub);
  b.state.speed = kmh / 3.6;
  let n = 0;
  while (b.state.speed > 0 && n++ < 600) b.step(DT, input({ brake: 1 }), env);
  return b.state.pos.z;
}

/** hold a constant speed (as if the throttle balanced drag) with a fixed steering input; returns [radius, lean] */
function steadyTurn(speed: number, steer: number, env: RideEnv = FLAT_ENV, seconds = 4): [number, number] {
  const b = new BikePhysics(BIKES.cub);
  for (let i = 0; i < seconds / DT; i++) {
    b.state.speed = speed;
    b.step(DT, input({ steer }), env);
  }
  return [speed / Math.abs(b.state.yawRate), b.state.lean];
}

describe('BikePhysics — braking', () => {
  it('stops from 40 km/h in ~8.7 m dry and ~13.3 m wet', () => {
    const dry = stoppingDistance(FLAT_ENV);
    const wet = stoppingDistance(WET);
    // v²/2a with brakes + ~0.6 m/s² mean drag/rolling: dry 6.5 + 0.6 → 8.7 m; wet 6.5·0.6/0.95 + 0.6 → 13.1 m
    expect(dry).toBeGreaterThan(8.3);
    expect(dry).toBeLessThan(9.2);
    expect(wet).toBeGreaterThan(12.6);
    expect(wet).toBeLessThan(14.0);
    expect(wet / dry).toBeGreaterThan(1.45);
  });

  it('dives the nose under hard braking and squats under throttle', () => {
    const b = new BikePhysics(BIKES.scooter);
    b.state.speed = 12;
    for (let i = 0; i < 12; i++) b.step(DT, input({ brake: 1 }), FLAT_ENV);
    expect(b.state.pitch).toBeGreaterThan(0.04);
    const c = new BikePhysics(BIKES.scooter);
    for (let i = 0; i < 20; i++) c.step(DT, input({ throttle: 1 }), FLAT_ENV);
    expect(c.state.pitch).toBeLessThan(-0.01);
  });
});

describe('BikePhysics — cornering', () => {
  it('leans atan(v²/gR): 8 m/s on a 10 m radius → 33.1° to the right', () => {
    const v = 8;
    const steerFor10m = Math.atan(BIKES.cub.wheelbase / 10) / maxSteerAt(BIKES.cub, v);
    const [r, lean] = steadyTurn(v, steerFor10m);
    expect(r).toBeCloseTo(10, 1);
    expect(lean).toBeCloseTo(Math.atan((v * v) / (G * 10)), 2);
    expect(lean).toBeGreaterThan(0.5); // + = right
  });

  it('a full-lock dry turn stays inside the grip limit; the same line in the wet runs wide and slides', () => {
    const v = 30 / 3.6;
    const [rDry, leanDry] = steadyTurn(v, 1);
    const b = new BikePhysics(BIKES.cub);
    for (let i = 0; i < 120; i++) {
      b.state.speed = v;
      b.step(DT, input({ steer: 1 }), WET);
    }
    const rWet = v / Math.abs(b.state.yawRate);
    expect((v * v) / rDry).toBeLessThanOrEqual(RIDE.gripDry * G * 1.001);
    expect(rWet).toBeGreaterThan(rDry * 1.5);
    expect(b.skid).toBeGreaterThan(0.5);
    expect(Math.abs(b.state.slip)).toBeGreaterThan(0.05);
    expect(leanDry).toBeLessThanOrEqual(RIDE.maxLean);
  });

  it('U-turns at walking pace inside a 2.5 m radius (feet-down pivot)', () => {
    const b = new BikePhysics(BIKES.sport);
    let maxX = 0;
    for (let i = 0; i < 10 / DT && Math.abs(wrapAngle(b.state.heading)) < Math.PI * 0.999; i++) {
      b.state.speed = 1.5;
      b.step(DT, input({ steer: -1 }), FLAT_ENV);
      maxX = Math.max(maxX, b.state.pos.x);
      if (Math.abs(wrapAngle(b.state.heading)) > Math.PI - 0.02) break;
    }
    expect(b.state.feetDown).toBe(true);
    expect(maxX / 2).toBeLessThan(2.5);
    expect(maxX / 2).toBeGreaterThan(0.8);
  });

  it('bars travel at the same rate at 10 and 60 km/h, with less lock at speed', () => {
    expect(maxSteerAt(BIKES.cub, 0)).toBeCloseTo(BIKES.cub.handling, 6);
    expect(maxSteerAt(BIKES.cub, 60 / 3.6)).toBeLessThanOrEqual(RIDE.steerAtSpeed);
    expect(maxSteerAt(BIKES.cub, 3)).toBeGreaterThan(maxSteerAt(BIKES.cub, 10));
  });
});

describe('BikePhysics — speed', () => {
  for (const bike of Object.values(BIKES)) {
    it(`${bike.id} tops out at ${(bike.topSpeed * 3.6).toFixed(0)} km/h`, () => {
      const b = new BikePhysics(bike);
      let peak = 0;
      for (let i = 0; i < 60 / DT; i++) {
        b.step(DT, input({ throttle: 1 }), FLAT_ENV);
        peak = Math.max(peak, b.state.speed);
      }
      expect(b.state.speed / bike.topSpeed).toBeGreaterThan(0.99);
      expect(peak).toBeLessThanOrEqual(bike.topSpeed + 1e-9);
    });
  }

  it('0→30 km/h takes about speed / accel', () => {
    const b = new BikePhysics(BIKES.cub);
    let t = 0;
    while (b.state.speed < 30 / 3.6 && t < 20) {
      b.step(DT, input({ throttle: 1 }), FLAT_ENV);
      t += DT;
    }
    expect(t).toBeGreaterThan(3.2);
    expect(t).toBeLessThan(4.2);
  });

  it('tucking narrows the bike by 22 % and caps the speed at 15 km/h', () => {
    const b = new BikePhysics(BIKES.scooter);
    b.state.speed = 40 / 3.6;
    for (let i = 0; i < 6 / DT; i++) b.step(DT, input({ throttle: 1, tuck: true }), FLAT_ENV);
    expect(b.state.width).toBeCloseTo(BIKES.scooter.mirrorSpan * RIDE.tuckWidthFactor, 6);
    expect(b.state.speed).toBeLessThanOrEqual(RIDE.tuckTopSpeed + 0.05);
    b.step(DT, input({ throttle: 1 }), { ...FLAT_ENV, extraWidth: RIDE.bagsExtraWidth });
    // a shopper's bags stick out past the mirrors
    expect(b.state.obb.hw * 2).toBeCloseTo(BIKES.scooter.width + RIDE.bagsExtraWidth, 6);
    expect(b.state.width).toBeCloseTo(BIKES.scooter.width + RIDE.bagsExtraWidth, 6);
  });

  it('walks backwards on a held brake at a standstill', () => {
    const b = new BikePhysics(BIKES.cub);
    for (let i = 0; i < 1.5 / DT; i++) b.step(DT, input({ brake: 1 }), FLAT_ENV);
    expect(b.state.speed).toBeCloseTo(-RIDE.walkBackSpeed, 1);
    expect(b.state.pos.z).toBeLessThan(-0.5);
  });

  it('wet grip blends with wetness', () => {
    expect(gripFor(0)).toBe(RIDE.gripDry);
    expect(gripFor(1)).toBeCloseTo(RIDE.gripWet, 9);
    expect(gripFor(0.5)).toBeCloseTo((RIDE.gripDry + RIDE.gripWet) / 2, 9);
  });
});

describe('BikePhysics — falls', () => {
  it('falls to the leaning side, slides to a stop and gets up after the recovery timer', () => {
    const bus = new EventBus();
    const log: string[] = [];
    bus.on('player:fall', () => log.push('fall'));
    bus.on('player:recover', () => log.push('recover'));
    const b = new BikePhysics(BIKES.cub, bus);
    for (let i = 0; i < 90; i++) {
      b.state.speed = 8;
      b.step(DT, input({ steer: -0.6 }), FLAT_ENV);
    }
    expect(b.state.lean).toBeLessThan(-0.2);
    b.fall('test');
    let lowest = 0;
    for (let i = 0; i < 1.5 / DT; i++) {
      b.step(DT, input({ throttle: 1 }), FLAT_ENV);
      lowest = Math.min(lowest, b.state.lean);
    }
    expect(b.state.fallen).toBe(true);
    expect(b.state.speed).toBe(0);
    expect(lowest).toBeLessThan(-1.1);
    for (let i = 0; i < RIDE.fallDuration / DT; i++) b.step(DT, input({}), FLAT_ENV);
    expect(b.state.fallen).toBe(false);
    expect(log).toEqual(['fall', 'recover']);
    b.step(DT, input({ throttle: 1 }), FLAT_ENV);
    expect(b.state.speed).toBeGreaterThan(0);
  });
});
