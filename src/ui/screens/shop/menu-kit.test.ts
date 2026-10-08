import { describe, expect, it } from 'vitest';
import { BIKES } from '../../../core/config/bikes';
import { CATALOG, itemById } from '../../../core/config/catalog';
import type { CatalogItem } from '../../../core/types/save';
import type { BikeModelId } from '../../../core/types/player';
import { buy } from '../../../logic/economy';
import { createDefaultSave } from '../../../logic/save-defaults';
import { bikeLine, bikeSpec, itemState, itemsOf } from './menu-catalog';
import { bestValueId } from './shop-fuel';
import { fuelRack } from './menu-art';

const item = (id: string): CatalogItem => {
  const it = itemById(id);
  if (!it) throw new Error(`missing catalog item ${id}`);
  return it;
};

describe('itemState', () => {
  it('marks worn items equipped, bought ones owned and the rest locked', () => {
    const save = createDefaultSave();
    expect(itemState(save, item(`bike:${save.loadout.bike}`))).toBe('equipped');
    expect(itemState(save, item('bike:scooter'))).toBe('locked');
    const res = buy({ ...save, baht: 5000 }, 'bike:scooter');
    expect(res.ok).toBe(true);
    expect(itemState(res.save, item('bike:scooter'))).toBe('owned');
  });

  it('treats a colour as equipped when any slot wears it', () => {
    const save = createDefaultSave();
    for (const id of [save.loadout.bikeColor, save.loadout.helmetColor, save.loadout.outfitColor, save.loadout.gearColor]) {
      expect(itemState(save, item(id))).toBe('equipped');
    }
    expect(itemState(save, item('color:chili_red'))).toBe('locked');
  });
});

describe('bikeSpec', () => {
  const ids = Object.keys(BIKES) as BikeModelId[];

  it('gives four bars in a fixed order with values inside 0..1', () => {
    for (const id of ids) {
      const rows = bikeSpec(id);
      expect(rows.map((r) => r.key)).toEqual(['speed', 'accel', 'handling', 'width']);
      for (const r of rows) {
        expect(r.value).toBeGreaterThan(0);
        expect(r.value).toBeLessThanOrEqual(1);
      }
      expect(rows.filter((r) => r.inverse).map((r) => r.key)).toEqual(['width']);
    }
  });

  it('formats real bike numbers (km/h, cm) and ranks the sport bike fastest and widest', () => {
    const cub = bikeSpec('cub');
    const sport = bikeSpec('sport');
    expect(cub[0].display).toBe(`${Math.round(BIKES.cub.topSpeed * 3.6)}km/h`);
    expect(cub[3].display).toBe(`${Math.round(BIKES.cub.mirrorSpan * 100)}cm`);
    expect(sport[0].value).toBeGreaterThan(cub[0].value);
    expect(sport[3].value).toBeGreaterThan(cub[3].value);
    expect(bikeLine('cub')).toBe(`최고 ${cub[0].display} · 차폭 ${cub[3].display}`);
  });
});

describe('bestValueId', () => {
  it('picks the pack with the lowest price per trip', () => {
    const packs = itemsOf(CATALOG, 'fuel');
    const perTrip = (p: CatalogItem): number => p.price / (p.amount ?? 1);
    const cheapest = [...packs].sort((a, b) => perTrip(a) - perTrip(b))[0];
    expect(bestValueId(packs)).toBe(cheapest.id);
  });

  it('keeps the first pack on a tie and returns null for no packs', () => {
    const a: CatalogItem = { id: 'fuel:a', category: 'fuel', name: 'a', amount: 2, price: 40, starter: false };
    const b: CatalogItem = { id: 'fuel:b', category: 'fuel', name: 'b', amount: 4, price: 80, starter: false };
    expect(bestValueId([a, b])).toBe('fuel:a');
    expect(bestValueId([])).toBeNull();
  });
});

describe('fuelRack', () => {
  const inside = (n: number): void => {
    const { scale, bottles } = fuelRack(n);
    for (const b of bottles) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + 12 * scale).toBeLessThanOrEqual(48);
      expect(b.y + 36 * scale).toBeLessThanOrEqual(48);
    }
  };

  it('draws one bottle, a single shelf row, or two rows of six', () => {
    expect(fuelRack(1).bottles).toHaveLength(1);
    expect(fuelRack(1).shelves).toHaveLength(0);
    const five = fuelRack(5);
    expect(five.bottles).toHaveLength(5);
    expect(new Set(five.bottles.map((b) => b.y)).size).toBe(1);
    expect(five.shelves).toHaveLength(1);
    const twelve = fuelRack(12);
    expect(twelve.shelves).toHaveLength(2);
    const ys = [...new Set(twelve.bottles.map((b) => b.y))];
    expect(ys).toHaveLength(2);
    expect(twelve.bottles.filter((b) => b.y === ys[0])).toHaveLength(6);
  });

  it('centres each row in the 48 px box without overlapping bottles', () => {
    for (const n of [1, 3, 5, 12]) {
      inside(n);
      const { scale, bottles } = fuelRack(n);
      const row = bottles.filter((b) => b.y === bottles[0].y);
      const left = row[0].x;
      const right = row[row.length - 1].x + 12 * scale;
      expect((left + right) / 2).toBeCloseTo(24, 5);
      for (let i = 1; i < row.length; i++) expect(row[i].x - row[i - 1].x).toBeGreaterThanOrEqual(12 * scale);
    }
  });

  it('clamps odd amounts to 1..12 bottles', () => {
    expect(fuelRack(0).bottles).toHaveLength(1);
    expect(fuelRack(Number.NaN).bottles).toHaveLength(1);
    expect(fuelRack(40).bottles).toHaveLength(12);
    inside(40);
  });
});
