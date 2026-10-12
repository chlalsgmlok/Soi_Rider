import { describe, expect, it } from 'vitest';
import { FUEL_REGEN_CAP } from '../core/config/catalog';
import type { SaveData } from '../core/types';
import { startRun } from './economy';
import { FUEL_REGEN_MS, fmtRegen, fuelRegenLeftMs, regenFuel, startRegenClock } from './fuel-regen';
import { createDefaultSave } from './save-defaults';

const T0 = 1_700_000_000_000;
const fresh = (over: Partial<SaveData> = {}): SaveData => ({ ...createDefaultSave(), ...over });

describe('regenFuel — one fuel every 30 minutes up to 5', () => {
  it('adds nothing before a full interval and returns the same object', () => {
    const s = fresh({ fuel: 2, fuelRegenAt: T0 });
    expect(regenFuel(s, T0 + FUEL_REGEN_MS - 1)).toBe(s);
  });

  it('a clock wound back restarts the interval from now instead of freezing it', () => {
    const s = fresh({ fuel: 2, fuelRegenAt: T0 });
    const r = regenFuel(s, T0 - 3_600_000);
    expect(r).toMatchObject({ fuel: 2, fuelRegenAt: T0 - 3_600_000 });
    expect(fuelRegenLeftMs(r, T0 - 3_600_000)).toBe(FUEL_REGEN_MS);
    expect(regenFuel(r, T0 - 3_600_000 + FUEL_REGEN_MS).fuel).toBe(3);
  });

  it('adds one per interval and keeps the remainder of the running interval', () => {
    const s = fresh({ fuel: 1, fuelRegenAt: T0 });
    const r = regenFuel(s, T0 + 2 * FUEL_REGEN_MS + 60_000);
    expect(r.fuel).toBe(3);
    expect(r.fuelRegenAt).toBe(T0 + 2 * FUEL_REGEN_MS);
    expect(fuelRegenLeftMs(r, T0 + 2 * FUEL_REGEN_MS + 60_000)).toBe(FUEL_REGEN_MS - 60_000);
    expect(s.fuel).toBe(1); // immutable
  });

  it('time spent with the game closed counts, but never past the cap', () => {
    const r = regenFuel(fresh({ fuel: 0, fuelRegenAt: T0 }), T0 + 24 * 60 * 60_000);
    expect(r.fuel).toBe(FUEL_REGEN_CAP);
    expect(r.fuelRegenAt).toBe(T0 + 24 * 60 * 60_000);
    expect(fuelRegenLeftMs(r, T0 + 24 * 60 * 60_000)).toBeNull();
  });

  it('a tank at or above the cap (bought fuel) never regenerates', () => {
    const full = fresh({ fuel: FUEL_REGEN_CAP, fuelRegenAt: T0 });
    expect(regenFuel(full, T0 + 10 * FUEL_REGEN_MS)).toBe(full);
    const bought = fresh({ fuel: 9, fuelRegenAt: T0 });
    expect(regenFuel(bought, T0 + 10 * FUEL_REGEN_MS)).toBe(bought);
    expect(fuelRegenLeftMs(bought, T0)).toBeNull();
  });
});

describe('the refill clock', () => {
  it('starts when a trip takes a full tank below the cap', () => {
    const before = fresh({ fuel: FUEL_REGEN_CAP, fuelRegenAt: 0 });
    expect(startRegenClock(before, { ...before, fuel: FUEL_REGEN_CAP - 1 }, T0).fuelRegenAt).toBe(T0);
    // already below the cap: the running clock is kept
    const running = fresh({ fuel: 3, fuelRegenAt: T0 });
    expect(startRegenClock(running, { ...running, fuel: 2 }, T0 + 5_000).fuelRegenAt).toBe(T0);
    // bought fuel above the cap: still full afterwards, no clock
    const over = fresh({ fuel: 8, fuelRegenAt: 0 });
    expect(startRegenClock(over, { ...over, fuel: 7 }, T0).fuelRegenAt).toBe(0);
  });

  it('startRun spends one fuel and the first free one arrives 30 minutes later', () => {
    const r = startRun(fresh({ fuel: FUEL_REGEN_CAP }), T0);
    expect(r.ok).toBe(true);
    expect(r.save).toMatchObject({ fuel: FUEL_REGEN_CAP - 1, fuelRegenAt: T0 });
    expect(fuelRegenLeftMs(r.save, T0)).toBe(FUEL_REGEN_MS);
    expect(regenFuel(r.save, T0 + FUEL_REGEN_MS - 1).fuel).toBe(FUEL_REGEN_CAP - 1);
    expect(regenFuel(r.save, T0 + FUEL_REGEN_MS).fuel).toBe(FUEL_REGEN_CAP);
  });

  it('formats the countdown as m:ss', () => {
    expect(fmtRegen(FUEL_REGEN_MS)).toBe('30:00');
    expect(fmtRegen(59_001)).toBe('1:00');
    expect(fmtRegen(9_000)).toBe('0:09');
    expect(fmtRegen(-1)).toBe('0:00');
  });
});
