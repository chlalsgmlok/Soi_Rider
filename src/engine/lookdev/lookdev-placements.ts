import { PALETTE as P } from '../../core/config/palette';

/** [asset, x, z, heading, recolours (material → hex)] — three.js world, heading = rotation.y */
export type Placement = [string, number, number, number, Record<string, string>?];

const FACE_W = -Math.PI / 2; // facade/front toward −X (east side of the main road)
const FACE_E = Math.PI / 2; // toward +X (west side)
const WALLS = [P.wallCream, P.wallMint, P.wallLemon, P.wallPink, P.wallPowder, P.wallSalmon, P.wallWhite];
const AWN = [P.awningRed, P.awningGreen, P.awningBlue];
const SHOP = ['bld_shophouse_3f', 'bld_shophouse_2f', 'bld_shophouse_4f', 'bld_shophouse_3f', 'bld_shophouse_2f'];

function row(x: number, z0: number, z1: number, heading: number, seed: number): Placement[] {
  const out: Placement[] = [];
  let i = seed;
  for (let z = z0; z <= z1; z += 4, i++) {
    out.push([SHOP[i % SHOP.length], x, z, heading, {
      Wall: WALLS[i % WALLS.length], Wall2: WALLS[(i + 3) % WALLS.length], Awning_A: AWN[i % AWN.length],
    }]);
  }
  return out;
}

export const BUILDINGS: Placement[] = [
  ...row(10.2, -34, 4, FACE_W, 0),
  ...row(10.2, 17, 41, FACE_W, 3),
  ...row(-10.2, -34, 41, FACE_E, 5),
  ['bld_minimart', 24, 16.2, Math.PI, {}],
  ['bld_shophouse_3f', 32, 16.2, Math.PI, { Wall: P.wallMint }],
  ['bld_condo', 34, -40, FACE_W, {}],
  ['bld_office', -36, 30, FACE_E, {}],
  ['bld_temple', -44, -20, FACE_E, {}],
];

export const PROPS: Placement[] = [
  ['prop_food_cart', 8.7, 0.6, FACE_W],
  ['prop_umbrella', 9.2, -1.6, 0, { Canvas: P.awningRed }],
  ['prop_table', 9.0, -1.8, 0],
  ['prop_stool', 8.3, -1.4, 0, { Plastic: '#e24b3b' }],
  ['prop_stool', 9.6, -2.3, 0, { Plastic: '#3f7fd0' }],
  ['prop_stool', 8.4, -2.4, 0, { Plastic: '#e24b3b' }],
  ['prop_bougainvillea', 7.9, -5.2, 0],
  ['prop_bougainvillea', 7.9, 4.6, 0],
  ['prop_pot_plant', 9.6, -7.0, 0],
  ['prop_banana', 9.6, -9.6, 0],
  ['prop_bougainvillea', -7.9, -2.0, 0],
  ['prop_pot_plant', -7.9, 6.0, 0],
  ['prop_banana', -9.5, 10.0, 0],
  ['prop_spirit_house', 9.6, -12.4, FACE_W],
  ['prop_soi_sign', 7.7, 5.4, FACE_W],
  ['prop_traffic_light', 7.6, 1.2, Math.PI],
  ['prop_traffic_light', -7.6, 14.6, 0],
  ['prop_street_lamp', 7.55, -16, FACE_W],
  ['prop_street_lamp', -7.55, 0, FACE_E],
  ['prop_street_lamp', -7.55, 24, FACE_E],
  ['prop_win_stand', 8.8, -21, FACE_W],
  ['prop_crates', 9.7, 2.6, 0],
  ['prop_ice_box', 9.4, 3.4, FACE_W],
  ['prop_bin', -8.0, -10, 0],
  ['prop_raintree', -9.0, -24, 0],
  ['prop_palm', 30, 4.5, 0],
  ['prop_barrier', 1.0, 14.5, Math.PI / 2],
  ['prop_cone', 0.2, 13.8, 0],
];

export const POLES: Placement[] = [
  ['prop_power_pole', 7.45, -30, FACE_W],
  ['prop_power_pole', 7.45, -10, FACE_W],
  ['prop_power_pole', 7.45, 9.6, FACE_W],
  ['prop_power_pole', 7.45, 30, FACE_W],
];

export const VEHICLES: Placement[] = [
  ['veh_taxi', 4.9, -1.2, 0.05, { Paint: P.taxiPink, Paint2: P.taxiPink }],
  ['veh_taxi', -1.9, 3.5, Math.PI - 0.04, { Paint: P.taxiGreen, Paint2: P.taxiYellow }],
  ['veh_taxi', 5.1, 11.5, 0.02, { Paint: P.taxiYellow, Paint2: P.taxiGreen }],
  ['veh_tuktuk', 5.2, 5.6, 0.08, { Paint: P.tuktukBlue, Paint2: P.taxiYellow }],
  ['veh_van', 1.6, 7.2, -0.03, { Paint: P.vanWhite, Paint2: P.vanWhite }],
  ['veh_van', -5.2, -9.5, Math.PI, { Paint: P.vanWhite, Paint2: P.vanWhite }],
  ['veh_sedan', -1.8, -14, Math.PI, { Paint: P.carSilver, Paint2: P.carSilver }],
  ['veh_bus', -5.3, 24, Math.PI, {}],
  ['veh_pickup', 1.8, 19, 0, { Paint: P.carWhite, Paint2: P.carWhite }],
  ['veh_songthaew', 14, 9.4, -Math.PI / 2, {}],
];

/** [bike, x, z, heading, shirt, helmet colour] — NPC motorbikes with riders */
export const MOTOS: Array<[string, number, number, number, string, string]> = [
  ['bike_cub', 0.8, -7.5, 0.06, '#3c6fd1', P.carWhite],
  ['bike_scooter', 6.2, -8.5, 0, '#e24b3b', P.taxiRed],
  ['bike_cub', 3.4, 2.4, 0.1, '#3e9d5a', '#3e9d5a'],
  ['bike_scooter', -0.9, 10.5, Math.PI + 0.05, '#f3f1ec', P.carBlack],
  ['bike_cub', -4.0, -3, Math.PI, '#ff8a2a', P.carWhite],
  ['bike_sport', 3.0, 13.5, 0.02, '#2a2d33', P.taxiPink],
];

/** pedestrians: [x, z, heading, shirt] */
export const PEOPLE: Array<[number, number, number, string]> = [
  [8.9, -3.4, FACE_W, '#f3f1ec'], [9.3, 1.9, Math.PI, '#3c6fd1'], [8.1, -14, 0.4, '#e24b3b'],
  [-8.4, 3.0, FACE_E, '#f7c928'], [-8.8, -6.0, 0, '#3e9d5a'], [9.5, -19.5, FACE_W, P.taxiOrange],
];
