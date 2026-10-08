/** Every GLB in docs/ASSET_SPEC.md, grouped as authored by the Blender pipeline (public/assets/models/<name>.glb). */
export const ASSET_GROUPS = {
  vehicles: ['veh_taxi', 'veh_sedan', 'veh_van', 'veh_pickup', 'veh_tuktuk', 'veh_bus', 'veh_songthaew', 'bts_train'],
  bikes: ['bike_cub', 'bike_scooter', 'bike_sport'],
  gear: ['gear_topbox', 'gear_bag', 'gear_rack', 'gear_cushion', 'gear_backrest', 'gear_throne'],
  characters: ['char_body'],
  headwear: [
    'hair_short', 'hair_long', 'hair_bun', 'hat_cap', 'acc_mask',
    'helmet_open', 'helmet_full', 'helmet_half', 'helmet_cat',
  ],
  outfits: ['outfit_vest', 'outfit_hood', 'outfit_jacket', 'outfit_poncho'],
  buildings: [
    'bld_shophouse_2f', 'bld_shophouse_3f', 'bld_shophouse_4f', 'bld_minimart', 'bld_mall', 'bld_condo', 'bld_office',
    'bld_temple', 'bts_pillar', 'bts_deck', 'bts_station',
  ],
  propsStreet: [
    'prop_food_cart', 'prop_stool', 'prop_table', 'prop_umbrella', 'prop_pot_plant', 'prop_banana', 'prop_bougainvillea',
    'prop_palm', 'prop_raintree', 'prop_crates', 'prop_ice_box', 'prop_ac_unit', 'prop_spirit_house',
  ],
  propsInfra: [
    'prop_power_pole', 'prop_street_lamp', 'prop_traffic_light', 'prop_soi_sign', 'prop_bus_stop', 'prop_win_stand',
    'prop_bin', 'prop_barrier', 'prop_cone', 'prop_hydrant',
  ],
} as const;

export type AssetGroup = keyof typeof ASSET_GROUPS;
export type AssetName = (typeof ASSET_GROUPS)[AssetGroup][number];

export const ASSET_NAMES: readonly AssetName[] = Object.values(ASSET_GROUPS).flat();

export const isAssetName = (name: string): name is AssetName => (ASSET_NAMES as readonly string[]).includes(name);
