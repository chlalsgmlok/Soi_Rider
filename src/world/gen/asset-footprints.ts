import type { ColliderTag } from '../../core/types';

/**
 * Ground footprints of street props at scale 1 (data table, measured from the GLBs in public/assets/models).
 * `keep` = keep-out radius (circle) or [width along the model's X, length along its forward axis] (box) used to
 * stop props overlapping each other; `col` = the static collider (null = walk/ride-through, e.g. umbrella poles).
 */
export interface Footprint {
  keep: number | readonly [number, number];
  col: { tag: ColliderTag; r: number } | { tag: ColliderTag; w: number; l: number } | null;
}

export const FOOTPRINTS: Readonly<Record<string, Footprint>> = {
  prop_power_pole: { keep: 0.6, col: { tag: 'pole', r: 0.2 } },
  prop_street_lamp: { keep: 0.6, col: { tag: 'pole', r: 0.18 } },
  prop_traffic_light: { keep: 0.7, col: { tag: 'pole', r: 0.2 } },
  prop_soi_sign: { keep: 0.5, col: { tag: 'pole', r: 0.08 } },
  prop_raintree: { keep: 1.3, col: { tag: 'tree', r: 0.45 } },
  prop_palm: { keep: 0.9, col: { tag: 'tree', r: 0.3 } },
  prop_banana: { keep: 0.75, col: { tag: 'tree', r: 0.38 } },
  prop_bougainvillea: { keep: 0.75, col: { tag: 'tree', r: 0.4 } },
  prop_pot_plant: { keep: 0.5, col: { tag: 'furniture', r: 0.3 } },
  prop_food_cart: { keep: [2.6, 1.5], col: { tag: 'cart', w: 2.2, l: 0.95 } },
  prop_stool: { keep: 0.32, col: { tag: 'furniture', r: 0.19 } },
  prop_table: { keep: 0.6, col: { tag: 'furniture', r: 0.42 } },
  prop_umbrella: { keep: 0.25, col: null },
  prop_crates: { keep: 0.5, col: { tag: 'furniture', r: 0.38 } },
  prop_ice_box: { keep: 0.5, col: { tag: 'furniture', r: 0.38 } },
  prop_spirit_house: { keep: 0.8, col: { tag: 'furniture', r: 0.45 } },
  prop_bus_stop: { keep: [4.8, 2.1], col: { tag: 'furniture', w: 4.5, l: 1.6 } },
  prop_win_stand: { keep: [2.9, 1.8], col: { tag: 'furniture', w: 2.6, l: 1.6 } },
  prop_bin: { keep: 0.45, col: { tag: 'furniture', r: 0.3 } },
  prop_barrier: { keep: [1.35, 0.6], col: { tag: 'barrier', w: 1.2, l: 0.45 } },
  prop_cone: { keep: 0.3, col: { tag: 'barrier', r: 0.2 } },
  prop_hydrant: { keep: 0.4, col: { tag: 'furniture', r: 0.18 } },
};

/** footprint of a prop (throws on an unknown asset — every street prop must be listed above) */
export function footprintOf(asset: string): Footprint {
  const f = FOOTPRINTS[asset];
  if (!f) throw new Error(`no footprint for ${asset}`);
  return f;
}
