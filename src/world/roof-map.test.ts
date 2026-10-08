import { describe, expect, it } from 'vitest';
import type { CityData, Placement } from '../core/types';
import { createCityQuery } from './city-query';
import { generateCity } from './gen/generate';
import { DEFAULT_ROOF, RoofMap } from './roof-map';

const bounds = { minX: -50, minZ: -50, maxX: 50, maxZ: 50 };

function cityWith(placements: Placement[]): CityData {
  return { placements } as CityData;
}

const place = (asset: string, x: number, z: number, heading: number): Placement => ({
  asset, pos: { x, z }, heading, scale: 1, variant: 0, collider: null,
});

describe('RoofMap', () => {
  it('stamps the body behind the facade plus the 2 m balcony/awning reach in front, at the model height', () => {
    // facade at z = 0 facing −Z (heading π) → body z ∈ [0, 10] plus the reach z ∈ [−2, 0]
    const map = new RoofMap(bounds, cityWith([place('bld_shophouse_3f', 0, 0, Math.PI)]));
    expect(map.at(0, 5)).toBe(11); // 10.5 rounded
    expect(map.at(1.8, 9.5)).toBe(11);
    expect(map.at(0, -1)).toBe(11); // balconies / awnings over the pavement
    expect(map.at(0, -3)).toBe(0); // street side
    expect(map.at(2.6, 5)).toBe(0); // beyond the 4 m frontage
  });

  it('keeps the taller roof where footprints overlap and ignores props', () => {
    const map = new RoofMap(bounds, cityWith([
      place('bld_shophouse_2f', 0, 0, 0),
      place('bld_shophouse_4f', 0, 0, 0),
      place('prop_food_cart', 20, 20, 0),
    ]));
    expect(map.at(0, -5)).toBe(14); // 13.5 rounded, body behind a +Z-facing facade
    expect(map.at(20, 20)).toBe(0);
  });

  it('lines building placements up with the surface raster (most building cells get a real model height)', () => {
    const data = generateCity(7, 'sukhumvit');
    const q = createCityQuery(data);
    let buildings = 0;
    let modelled = 0;
    for (let x = data.bounds.minX; x < data.bounds.maxX; x += 3) {
      for (let z = data.bounds.minZ; z < data.bounds.maxZ; z += 3) {
        if (q.surfaceAt(x, z) !== 4) continue;
        buildings++;
        const h = q.roofAt?.(x, z) ?? 0;
        expect(h).toBeGreaterThan(0);
        if (h !== DEFAULT_ROOF) modelled++;
      }
    }
    expect(buildings).toBeGreaterThan(500);
    expect(modelled / buildings).toBeGreaterThan(0.6);
  });
});
