import { describe, expect, it } from 'vitest';
import type { RunResult, SaveData } from '../core/types';
import {
  applyPayout, buy, canStartRun, cheapestFuelPrice, claimFreeRefill, consumeFuel, equip, FREE_REFILL_FUEL,
  freeRefillAvailable, owns, startRun, unownedItems,
} from './economy';
import { createDefaultSave } from './save-defaults';
import { computeResult } from './scoring';
import { makeConfig, makeJob, makeStats } from './testing/fixtures';

const fresh = (over: Partial<SaveData> = {}): SaveData => ({ ...createDefaultSave(), ...over });

describe('buy', () => {
  it('rejects unknown ids, owned items and missing funds without touching the save', () => {
    const s = fresh();
    expect(buy(s, 'bike:rocket')).toEqual({ ok: false, reason: 'unknown', save: s });
    expect(buy(s, 'bike:cub')).toEqual({ ok: false, reason: 'owned', save: s });
    expect(buy(s, 'color:jasmine').reason).toBe('owned');
    expect(buy(s, 'bike:scooter')).toEqual({ ok: false, reason: 'funds', save: s });
    expect(buy(fresh({ baht: 899 }), 'bike:scooter').reason).toBe('funds');
  });

  it('deducts the price and adds the item, immutably', () => {
    const s = fresh();
    const r = buy(s, 'helmet:helmet_half');
    expect(r.ok).toBe(true);
    expect(r.save.baht).toBe(120);
    expect(r.save.owned).toContain('helmet:helmet_half');
    expect(s.baht).toBe(300);
    expect(s.owned).not.toContain('helmet:helmet_half');
    expect(buy(r.save, 'helmet:helmet_half').reason).toBe('owned');
    expect(buy(fresh({ baht: 900 }), 'bike:scooter').save.baht).toBe(0);
  });

  it('fuel packs add fuel, can be bought repeatedly and are never owned', () => {
    let s = fresh();
    s = buy(s, 'fuel:5').save;
    expect(s.fuel).toBe(10);
    expect(s.baht).toBe(180);
    s = buy(s, 'fuel:1').save;
    expect(s.fuel).toBe(11);
    expect(s.baht).toBe(150);
    expect(buy(s, 'fuel:12').reason).toBe('funds');
    expect(owns(s, 'fuel:1')).toBe(false);
    expect(s.owned.some((id) => id.startsWith('fuel:'))).toBe(false);
    expect(cheapestFuelPrice()).toBe(30);
  });

  it('a colour is bought once and usable in every colour slot', () => {
    const s = buy(fresh(), 'color:leaf_green').save;
    expect(s.baht).toBe(300 - 120);
    const e = equip(s, { ...s.loadout, bikeColor: 'color:leaf_green', helmetColor: 'color:leaf_green', gearColor: 'color:leaf_green' });
    expect(e.loadout.bikeColor).toBe('color:leaf_green');
    expect(e.loadout.helmetColor).toBe('color:leaf_green');
    expect(e.loadout.gearColor).toBe('color:leaf_green');
  });
});

describe('equip', () => {
  it('keeps the current value for slots that are not owned or invalid', () => {
    const s = fresh();
    const e = equip(s, { ...s.loadout, bike: 'sport', helmet: 'helmet_cat', outfitColor: 'color:mango', nickname: '  Ploy  ' });
    expect(e.loadout.bike).toBe('cub');
    expect(e.loadout.helmet).toBe('helmet_open');
    expect(e.loadout.outfitColor).toBe('color:mango');
    expect(e.loadout.nickname).toBe('Ploy');
    expect(unownedItems(s, { ...s.loadout, bike: 'sport', helmet: 'helmet_cat' })).toEqual(['bike:sport', 'helmet:helmet_cat']);
  });

  it('accepts owned items and falls back to the current nickname when blank', () => {
    const s = buy(fresh({ baht: 5000 }), 'bike:sport').save;
    const e = equip(s, { ...s.loadout, bike: 'sport', nickname: '' });
    expect(e.loadout.bike).toBe('sport');
    expect(e.loadout.nickname).toBe('NONG');
  });
});

describe('fuel and the free refill', () => {
  it('start costs one fuel; an empty tank blocks the start', () => {
    expect(canStartRun(fresh({ fuel: 1 }))).toEqual({ ok: true, freeRefillAvailable: false });
    const r = startRun(fresh({ fuel: 1 }));
    expect(r.ok).toBe(true);
    expect(r.save.fuel).toBe(0);
    const empty = fresh({ fuel: 0 });
    expect(startRun(empty)).toEqual({ ok: false, save: empty, reason: 'noFuel' });
    expect(consumeFuel(empty)).toBe(empty);
    expect(canStartRun(fresh({ fuel: 0, baht: 100 }))).toEqual({ ok: false, reason: 'noFuel', freeRefillAvailable: false });
  });

  it('is offered only with an empty tank and less than 30 ฿', () => {
    expect(freeRefillAvailable(fresh({ fuel: 0, baht: 29 }))).toBe(true);
    expect(freeRefillAvailable(fresh({ fuel: 0, baht: 30 }))).toBe(false);
    expect(freeRefillAvailable(fresh({ fuel: 1, baht: 0 }))).toBe(false);
    expect(canStartRun(fresh({ fuel: 0, baht: 0 }))).toEqual({ ok: false, reason: 'noFuel', freeRefillAvailable: true });
  });

  it('grants 3 fuel and then needs 3 more finished trips', () => {
    const broke = fresh({ fuel: 0, baht: 10, tripsCompleted: 7 });
    const claimed = claimFreeRefill(broke);
    expect(claimed.fuel).toBe(FREE_REFILL_FUEL);
    expect(FREE_REFILL_FUEL).toBe(3);
    expect(claimed.freeRefillAtTrip).toBe(7);
    expect(claimFreeRefill({ ...claimed, fuel: 0 })).toEqual({ ...claimed, fuel: 0 });
    expect(freeRefillAvailable({ ...claimed, fuel: 0, tripsCompleted: 9 })).toBe(false);
    expect(freeRefillAvailable({ ...claimed, fuel: 0, tripsCompleted: 10 })).toBe(true);
    expect(claimFreeRefill(fresh({ fuel: 0, baht: 500 })).fuel).toBe(0);
  });

  it('cannot soft-lock: three failed runs on refill fuel make the next refill available', () => {
    let s = claimFreeRefill(fresh({ fuel: 0, baht: 0 }));
    const config = makeConfig();
    const fail = computeResult(config, makeJob('regular'), makeStats({ failed: 'comfort', finalComfort: 0 }));
    for (let i = 0; i < 3; i++) s = applyPayout(startRun(s).save, fail);
    expect(s.fuel).toBe(0);
    expect(s.baht).toBe(0);
    expect(canStartRun(s).freeRefillAvailable).toBe(true);
  });
});

describe('applyPayout', () => {
  const win = (total: number, grade: RunResult['grade'], totalBaht: number): RunResult => {
    const r = computeResult(makeConfig({ intensity: 'gridlock' }), makeJob('shopper'), makeStats());
    return { ...r, total, grade, totalBaht };
  };

  it('pays baht, counts the trip and records best score / grade per intensity', () => {
    const s = applyPayout(fresh({ bestScore: 5000 }), win(6200, 'A', 155));
    expect(s.baht).toBe(455);
    expect(s.tripsCompleted).toBe(1);
    expect(s.bestScore).toBe(6200);
    expect(s.bestGrade).toEqual({ light: null, rush: null, gridlock: 'A' });
    const worse = applyPayout(s, win(3100, 'C', 60));
    expect(worse.bestScore).toBe(6200);
    expect(worse.bestGrade.gridlock).toBe('A');
    expect(worse.baht).toBe(515);
    expect(applyPayout(worse, win(7600, 'S', 200)).bestGrade.gridlock).toBe('S');
  });

  it('a failed run pays nothing and keeps the records, but still counts as a trip', () => {
    const before = fresh({ bestScore: 4000, bestGrade: { light: 'B', rush: null, gridlock: null } });
    const fail = computeResult(makeConfig({ intensity: 'light' }), makeJob('hurry'), makeStats({ failed: 'timeout' }));
    const s = applyPayout(before, fail);
    expect(s.baht).toBe(300);
    expect(s.tripsCompleted).toBe(1);
    expect(s.bestScore).toBe(4000);
    expect(s.bestGrade.light).toBe('B');
  });
});
