import type { Group } from 'three';
import type { AssetName } from '../asset-names';
import {
  bikeCub, bikeScooter, bikeSport, gearBackrest, gearBag, gearCushion, gearRack, gearThrone, gearTopbox,
} from './bikes';
import {
  bldCondo, bldMall, bldMinimart, bldOffice, bldShophouse2f, bldShophouse3f, bldShophouse4f, bldTemple, btsDeck,
  btsPillar, btsStation,
} from './buildings';
import {
  accMask, charBody, hairBun, hairLong, hairShort, hatCap, helmetCat, helmetFull, helmetHalf, helmetOpen, outfitHood,
  outfitJacket, outfitPoncho, outfitVest,
} from './characters';
import {
  propBarrier, propBin, propBusStop, propCone, propHydrant, propPowerPole, propSoiSign, propStreetLamp,
  propTrafficLight, propWinStand,
} from './props-infra';
import {
  propAcUnit, propBanana, propBougainvillea, propCrates, propFoodCart, propIceBox, propPalm, propPotPlant,
  propRaintree, propSpiritHouse, propStool, propTable, propUmbrella,
} from './props-street';
import {
  btsTrain, vehicleBus, vehiclePickup, vehicleSedan, vehicleSongthaew, vehicleTaxi, vehicleTuktuk, vehicleVan,
} from './vehicles';

/** name → stand-in builder; exhaustive over AssetName so a new asset without a placeholder fails to compile */
const BUILDERS: Record<AssetName, () => Group> = {
  veh_taxi: vehicleTaxi, veh_sedan: vehicleSedan, veh_van: vehicleVan, veh_pickup: vehiclePickup,
  veh_tuktuk: vehicleTuktuk, veh_bus: vehicleBus, veh_songthaew: vehicleSongthaew, bts_train: btsTrain,
  bike_cub: bikeCub, bike_scooter: bikeScooter, bike_sport: bikeSport,
  gear_topbox: gearTopbox, gear_bag: gearBag, gear_rack: gearRack,
  gear_cushion: gearCushion, gear_backrest: gearBackrest, gear_throne: gearThrone,
  char_body: charBody,
  hair_short: hairShort, hair_long: hairLong, hair_bun: hairBun, hat_cap: hatCap, acc_mask: accMask,
  helmet_open: helmetOpen, helmet_full: helmetFull, helmet_half: helmetHalf, helmet_cat: helmetCat,
  outfit_vest: outfitVest, outfit_hood: outfitHood, outfit_jacket: outfitJacket, outfit_poncho: outfitPoncho,
  bld_shophouse_2f: bldShophouse2f, bld_shophouse_3f: bldShophouse3f, bld_shophouse_4f: bldShophouse4f,
  bld_minimart: bldMinimart, bld_mall: bldMall, bld_condo: bldCondo, bld_office: bldOffice, bld_temple: bldTemple,
  bts_pillar: btsPillar, bts_deck: btsDeck, bts_station: btsStation,
  prop_food_cart: propFoodCart, prop_stool: propStool, prop_table: propTable, prop_umbrella: propUmbrella,
  prop_pot_plant: propPotPlant, prop_banana: propBanana, prop_bougainvillea: propBougainvillea, prop_palm: propPalm,
  prop_raintree: propRaintree, prop_crates: propCrates, prop_ice_box: propIceBox, prop_ac_unit: propAcUnit,
  prop_spirit_house: propSpiritHouse,
  prop_power_pole: propPowerPole, prop_street_lamp: propStreetLamp, prop_traffic_light: propTrafficLight,
  prop_soi_sign: propSoiSign, prop_bus_stop: propBusStop, prop_win_stand: propWinStand, prop_bin: propBin,
  prop_barrier: propBarrier, prop_cone: propCone, prop_hydrant: propHydrant,
};

export function hasPlaceholder(name: string): name is AssetName {
  return Object.prototype.hasOwnProperty.call(BUILDERS, name);
}

/** coarse stand-in with the asset's node + material contract, or null for unknown names */
export function buildPlaceholder(name: string): Group | null {
  if (!hasPlaceholder(name)) return null;
  const g = BUILDERS[name]();
  g.userData.placeholder = true;
  return g;
}
