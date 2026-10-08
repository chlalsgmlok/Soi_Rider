import type { LodBands } from './instance-lod';

const BIG: ReadonlySet<string> = new Set(['bld_mall', 'bld_temple', 'bld_minimart', 'bts_deck', 'bts_pillar', 'bts_station']);
const TREES: ReadonlySet<string> = new Set(['prop_raintree', 'prop_palm', 'prop_banana']);
const TALL_PROPS: ReadonlySet<string> = new Set([
  'prop_bougainvillea', 'prop_spirit_house', 'prop_food_cart', 'prop_win_stand', 'prop_bus_stop', 'prop_traffic_light',
  'prop_street_lamp', 'prop_power_pole', 'prop_soi_sign',
]);

/**
 * Visibility bands per asset (metres), scaled by the quality preset's draw distance (medium = 340 m): buildings
 * reach the haze, trees and stands a little less, tiny street clutter only the near streets.
 */
export function lodBands(asset: string, drawDistance: number): LodBands {
  const k = drawDistance / 340;
  if (asset.startsWith('bld_shophouse')) return { lod: 85, cull: drawDistance };
  if (asset === 'bld_condo' || asset === 'bld_office') return { lod: 160, cull: drawDistance + 120 };
  if (BIG.has(asset)) return { lod: Infinity, cull: drawDistance + 60 };
  if (TREES.has(asset)) return { lod: 95, cull: drawDistance * 0.85 };
  if (TALL_PROPS.has(asset)) return { lod: Infinity, cull: 170 * k };
  return { lod: Infinity, cull: 115 * k };
}

/** extras (chunked wires / fences / hedges / lanterns) */
export const extraBands = (kind: 'wires' | 'street', drawDistance: number): LodBands =>
  ({ lod: Infinity, cull: (kind === 'wires' ? 170 : 210) * (drawDistance / 340) });
