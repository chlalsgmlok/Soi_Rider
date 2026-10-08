import { describe, expect, it } from 'vitest';
import { CATALOG, STARTER_LOADOUT } from '../core/config/catalog';
import type { GearId } from '../core/types';
import { ComfortModel } from './comfort';
import { CAT_HELMET_COMFORT, seatPerkOf, startingComfort, type ComfortTickInput } from './comfort-tuning';
import { computeResult } from './scoring';
import { makeConfig, makeJob, makeStats } from './testing/fixtures';

const DT = 1 / 60;
const calm: ComfortTickInput = {
  speed: 8, accel: 0, counterflow: false, sidewalk: false, rainingNoPoncho: false, smogNoMask: false, heatStoppedUnshaded: false,
};

/** comfort gained over `seconds` of calm riding from `from` */
function recovered(gear: GearId, from: number, seconds: number): number {
  const m = new ComfortModel('regular', from, seatPerkOf(gear));
  for (let i = 0; i < Math.round(seconds / DT); i++) m.tick(DT, calm);
  return m.value - from;
}

describe('pillion seat gear (뒷자리: cushion / backrest / throne)', () => {
  it('only the seat gear carries a perk, and the golden throne is the priciest gear in the shop', () => {
    const gear = CATALOG.filter((c) => c.category === 'gear');
    expect(gear.filter((c) => c.perk).map((c) => c.ref)).toEqual(['gear_cushion', 'gear_backrest', 'gear_throne']);
    const throne = gear.find((c) => c.ref === 'gear_throne');
    expect(throne?.price).toBeGreaterThan(Math.max(...CATALOG.filter((c) => c.ref !== 'gear_throne').map((c) => c.price)));
    expect(seatPerkOf('gear_topbox')).toBeNull();
    expect(seatPerkOf('none')).toBeNull();
  });

  it('adds to the starting comfort (cushion +3, backrest +5, throne +8), stacking with the cat helmet up to 100', () => {
    expect(startingComfort('helmet_open', 'gear_cushion')).toBe(83);
    expect(startingComfort('helmet_open', 'gear_backrest')).toBe(85);
    expect(startingComfort('helmet_open', 'gear_throne')).toBe(88);
    expect(startingComfort('helmet_cat', 'gear_throne')).toBe(Math.min(100, 88 + CAT_HELMET_COMFORT));
    expect(startingComfort('helmet_open', 'gear_bag')).toBe(80);
  });

  it('softens jolts (near miss, harsh brake, mirror, body) but never a fall', () => {
    const plain = new ComfortModel('nervous');
    const throne = new ComfortModel('nervous', 80, seatPerkOf('gear_throne'));
    expect(plain.event('mirror')?.delta).toBeCloseTo(-8, 9);
    expect(throne.event('mirror')?.delta).toBeCloseTo(-8 * 0.7, 9);
    expect(new ComfortModel('regular', 80, seatPerkOf('gear_cushion')).event('body')?.delta).toBeCloseTo(-10 * 0.9, 9);
    expect(throne.event('fall')?.delta).toBe(-25);
  });

  it('speeds up the smooth-riding recovery (throne ×1.6 of a plain seat)', () => {
    const plain = recovered('none', 50, 20);
    expect(plain).toBeGreaterThan(1);
    expect(recovered('gear_backrest', 50, 20) / plain).toBeCloseTo(1.35, 2);
    expect(recovered('gear_throne', 50, 20) / plain).toBeCloseTo(1.6, 2);
  });

  it('names the seat on the receipt comfort line, and only for seat gear', () => {
    const job = makeJob('regular');
    const stats = makeStats({ finalComfort: 90, timeSec: 100 });
    const withThrone = computeResult(makeConfig({ loadout: { ...STARTER_LOADOUT, gear: 'gear_throne' } }), job, stats);
    expect(withThrone.lines.find((l) => l.key === 'comfort')?.detail).toBe('승차감 90 · 황금 왕좌');
    const withBox = computeResult(makeConfig({ loadout: { ...STARTER_LOADOUT, gear: 'gear_topbox' } }), job, stats);
    expect(withBox.lines.find((l) => l.key === 'comfort')?.detail).toBe('승차감 90');
  });
});
