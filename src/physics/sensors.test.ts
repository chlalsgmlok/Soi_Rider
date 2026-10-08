import { describe, expect, it } from 'vitest';
import { BIKES } from '../core/config/bikes';
import { VEHICLES } from '../core/config/traffic';
import { BikePhysics } from '../player/bike-physics';
import { ClearanceSensor } from './clearance-sensor';
import type { ContactReport } from './collision-types';
import { StyleSensor } from './style-sensor';
import { StaticTraffic } from './testing/static-traffic';
import type { StyleEvent } from './style-events';

/**
 * Geometry used below (cub at the origin heading +Z; the rider's LEFT is +X):
 * cub mirror span 0.76 → mirror tips at x = ±0.38, mirror heads at y 1.12, z 0.5; bars ±0.33.
 * taxi: mirror span 2.0 at y 1.0 (same band as ours), mirrorZ 0.75; body 1.76 wide, belt 0.95, tumble 0.14.
 * van: mirrors at y 1.45 (above our mirrors and bars — only the shoulders reach that high), body 1.9 wide.
 */
function rider(x = 0, z = 0, heading = 0): BikePhysics {
  const b = new BikePhysics(BIKES.cub);
  b.teleport({ x, z }, heading);
  return b;
}

describe('ClearanceSensor', () => {
  it('measures mirror-to-mirror on the left; the high van mirror only reaches the shoulders on the right', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.taxi, 1.5, 0.5 - 0.75, 0); // taxi mirror level with ours, tip at x 0.5
    t.addVehicle(VEHICLES.van, -1.6, -1.2, 0); // van mirror tip at x −0.51, z 0.55
    const c = new ClearanceSensor().sense(rider(), null, t);
    expect(c.left).toBeCloseTo(0.12, 6); // 0.5 − 0.38
    // the van mirror (y 1.45) clears our bars and mirror; it could only meet the narrower shoulders (hw 0.25, set
    // back over the seat), so the tightest point is our mirror (0.38) → the van's flank (0.65)
    expect(c.right).toBeCloseTo(0.27, 6);
    expect(c.leftId).toBe(0);
    expect(c.rightId).toBe(1);
    expect(c.leftPoint?.x).toBeCloseTo(0.5, 6);
  });

  it('lets a mirror slide past a sedan flank above its belt line', () => {
    const t = new StaticTraffic();
    // sedan body edge at x 0.5, its mirrors far ahead (out of the ±1.5 m window)
    t.addVehicle(VEHICLES.sedan, 0.5 + VEHICLES.sedan.width / 2, 2.6, 0);
    const c = new ClearanceSensor().sense(rider(), null, t);
    // bars (body band, 0.33) → flank 0.5 = 0.17; our mirror (0.38) → glass house (0.5 + 0.14 tumble) = 0.26
    expect(c.left).toBeCloseTo(0.17, 6);
  });

  it('ignores a bus mirror above the helmet and things straight ahead', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.bus, -2.0, -4.6, 0); // bus mirror (y 2.1) beside us at z ≈ 0.8, tip x −0.55
    t.addVehicle(VEHICLES.taxi, 0, 4.0, 0); // dead ahead: not a side gap
    const c = new ClearanceSensor().sense(rider(), null, t);
    // the bus mirror tip (x −0.55) would read 0.22 at body height; it is above the helmet, so the flank counts:
    // our mirror (0.38) → bus side (x −0.75) = 0.37
    expect(c.right).toBeCloseTo(0.37, 6);
    expect(c.left).toBe(Infinity);
  });

  it('reports open space as Infinity and tucking widens the gaps', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.taxi, 1.5, -0.25, 0);
    const b = rider();
    const open = new ClearanceSensor().sense(b, null, t).left;
    b.step(1 / 60, { throttle: 0, brake: 0, steer: 0, tuck: true }, { grip: 0.95, surfaceAt: () => 1, extraWidth: 0 });
    const tucked = new ClearanceSensor().sense(b, null, t).left;
    expect(tucked).toBeGreaterThan(open + 0.07);
    expect(new ClearanceSensor().sense(rider(50, 50), null, t).right).toBe(Infinity);
  });
});

/** ride straight along +Z at `kmh` from z0 to z1, sensing every 1/60 s */
function ride(t: StaticTraffic, x: number, kmh: number, contactsAt?: (z: number) => ContactReport[]): StyleEvent[] {
  const b = rider(x, -8);
  const clear = new ClearanceSensor();
  const style = new StyleSensor();
  const all: StyleEvent[] = [];
  const v = kmh / 3.6;
  b.state.speed = v;
  for (let i = 0; i < 60 * 30 && b.state.pos.z < 10; i++) {
    b.displace(0, v / 60);
    clear.sense(b, null, t);
    all.push(...style.step(1 / 60, b, clear, contactsAt?.(b.state.pos.z) ?? [], t));
  }
  return all;
}

describe('StyleSensor', () => {
  it('pays one near miss when passing a parked taxi 12 cm off the mirror at 20 km/h', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.taxi, 1.5, 0, 0, { queued: false });
    const ev = ride(t, 0, 20);
    const nm = ev.filter((e) => e.kind === 'nearMiss');
    expect(nm).toHaveLength(1);
    expect(nm[0]).toMatchObject({ side: 'left' });
    if (nm[0].kind === 'nearMiss') expect(nm[0].clearanceCm).toBeCloseTo(12, 4);
  });

  it('pays nothing at walking pace or with a comfortable gap', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.taxi, 1.5, 0, 0, { queued: false });
    expect(ride(t, 0, 6)).toHaveLength(0);
    expect(ride(t, -0.3, 20)).toHaveLength(0); // 42 cm
  });

  it('turns two simultaneous tight gaps into one perfect gap (no separate near misses)', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.taxi, 1.5, 0, 0, { queued: false }); // left 12 cm
    t.addVehicle(VEHICLES.taxi, -1.48, 0, 0, { queued: false }); // right 10 cm
    const ev = ride(t, 0, 15);
    expect(ev.map((e) => e.kind)).toEqual(['perfectGap']);
    const pg = ev[0];
    if (pg.kind === 'perfectGap') {
      expect(pg.leftCm).toBeCloseTo(12, 4);
      expect(pg.rightCm).toBeCloseTo(10, 4);
    }
  });

  it('pays nothing for an obstacle that was touched', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.taxi, 1.5, 0, 0, { queued: false });
    const touch: ContactReport = { kind: 'mirror', heavy: false, speedKmh: 20, point: { x: 0.5, z: 0.7 }, otherId: 0, key: 0, other: 'taxi#0' };
    expect(ride(t, 0, 20, (z) => (z >= 0 && z < 0.1 ? [touch] : []))).toHaveLength(0);
  });

  it('counts a filter pass when overtaking a queued van in the same direction', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.van, 1.9, 0, 0, { queued: true });
    const ev = ride(t, 0, 15);
    expect(ev.filter((e) => e.kind === 'filterPass')).toHaveLength(1);
    const oncoming = new StaticTraffic();
    oncoming.addVehicle(VEHICLES.van, 1.9, 0, Math.PI, { queued: true });
    expect(ride(oncoming, 0, 15).filter((e) => e.kind === 'filterPass')).toHaveLength(0);
  });
});
