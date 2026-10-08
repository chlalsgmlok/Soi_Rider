import { PALETTE as P } from '../../core/config/palette';
import type { PassengerProfile, StaticCollider, VehicleKind } from '../../core/types';

/**
 * Player sandbox arena on the engine look-dev street (src/engine/lookdev/street-ground.ts): a 4-lane road along
 * Z (x −7..7, +Z traffic on the LEFT half x > 0, lane split at x ≈ 3.1), raised sidewalks with red-white curbs,
 * a soi joining from +X at z 6..13 and a zebra crossing at z ≈ 2.8.
 *
 * Two queued lanes of real vehicles leave 0.95–1.25 m between mirror tips — the hero gap (pink taxi | white van,
 * row 1) leaves a cub ≈ 12 cm per side; the others 15–25 cm.
 */
export interface ArenaVehicle {
  kind: Exclude<VehicleKind, 'moto'>;
  x: number;
  z: number;
  heading: number;
  paint: string;
  paint2: string;
}

export const ROAD_HALF = 7;
export const SIDEWALK_Y = 0.16;
export const SOI = { z0: 6, z1: 13 } as const;
export const CROSSWALK = { z0: 1.5, z1: 4.1 } as const;
export const LANE_X = [1.75, 5.25] as const;

const N = 0;
const S = Math.PI;

export const ARENA_VEHICLES: ArenaVehicle[] = [
  // row 1 at the stop line — the hero squeeze
  { kind: 'van', x: 1.6, z: -2.6, heading: N + 0.01, paint: P.vanWhite, paint2: P.vanWhite },
  { kind: 'taxi', x: 4.65, z: -2.0, heading: N - 0.015, paint: P.taxiPink, paint2: P.taxiPink },
  // row 2
  { kind: 'tuktuk', x: 1.9, z: -9.0, heading: N + 0.03, paint: P.tuktukBlue, paint2: P.taxiYellow },
  { kind: 'sedan', x: 4.9, z: -9.6, heading: N, paint: P.carSilver, paint2: P.carSilver },
  // row 3
  { kind: 'taxi', x: 1.7, z: -16.2, heading: N - 0.02, paint: P.taxiGreen, paint2: P.taxiYellow },
  { kind: 'pickup', x: 4.9, z: -16.8, heading: N + 0.01, paint: P.carWhite, paint2: P.carWhite },
  // row 4
  { kind: 'van', x: 1.75, z: -24.4, heading: N, paint: P.vanWhite, paint2: P.vanWhite },
  { kind: 'songthaew', x: 5.0, z: -25.0, heading: N + 0.02, paint: P.busRed, paint2: P.busRed },
  // oncoming side, for scenery
  { kind: 'taxi', x: -1.9, z: 4.5, heading: S - 0.04, paint: P.taxiYellow, paint2: P.taxiGreen },
  { kind: 'sedan', x: -1.8, z: -13, heading: S, paint: P.carNavy, paint2: P.carNavy },
  { kind: 'bus', x: -5.3, z: 22, heading: S, paint: P.busRed, paint2: P.busCream },
  { kind: 'tuktuk', x: -5.2, z: -6, heading: S + 0.05, paint: P.taxiGreen, paint2: P.taxiYellow },
];

/** queued NPC motos at the front of the queue, leaving the lane split open: [bike, x, z, heading, shirt, helmet] */
export const ARENA_MOTOS: Array<[string, number, number, number, string, string]> = [
  ['bike_cub', 0.95, 1.2, N + 0.05, '#3c6fd1', P.carWhite],
  ['bike_scooter', 2.1, 1.5, N - 0.04, '#e24b3b', P.taxiRed],
  ['bike_cub', 4.35, 1.1, N + 0.06, '#3e9d5a', '#3e9d5a'],
  ['bike_scooter', 5.55, 1.45, N, '#f3f1ec', P.carBlack],
  ['bike_cub', 6.3, -6.4, N + 0.03, '#ff8a2a', P.carWhite],
];

/** pedestrians: [x, z, heading, shirt] — two waiting at the crossing, one on the far walk */
export const ARENA_PEOPLE: Array<[number, number, number, string]> = [
  [7.6, 2.4, -Math.PI / 2, '#f3f1ec'],
  [8.1, 3.3, -Math.PI / 2 + 0.3, '#3c6fd1'],
  [-8.2, 3.0, Math.PI / 2, '#f7c928'],
];

/** solid street furniture (matches the look-dev props/poles placed in arena-scene) */
export const ARENA_COLLIDERS: StaticCollider[] = [
  ...[-30, -10, 9.6, 30].map((z, i): StaticCollider => ({ id: i, tag: 'pole', circle: { cx: 7.45, cz: z, r: 0.2 } })),
  { id: 10, tag: 'pole', circle: { cx: 7.55, cz: -16, r: 0.14 } },
  { id: 11, tag: 'pole', circle: { cx: -7.55, cz: 0, r: 0.14 } },
  { id: 12, tag: 'pole', circle: { cx: -7.55, cz: 24, r: 0.14 } },
  { id: 13, tag: 'pole', circle: { cx: 7.6, cz: 1.2, r: 0.16 } },
  { id: 14, tag: 'pole', circle: { cx: -7.6, cz: 14.6, r: 0.16 } },
  { id: 15, tag: 'barrier', obb: { cx: 1.0, cz: 14.5, hw: 0.6, hl: 0.25, angle: Math.PI / 2 } },
  { id: 16, tag: 'barrier', circle: { cx: 0.2, cz: 13.8, r: 0.2 } },
  { id: 17, tag: 'cart', obb: { cx: 8.7, cz: 0.6, hw: 0.55, hl: 0.85, angle: -Math.PI / 2 } },
  { id: 18, tag: 'tree', circle: { cx: -9.0, cz: -24, r: 0.45 } },
  { id: 19, tag: 'furniture', circle: { cx: 9.6, cz: -12.4, r: 0.35 } },
];

/** building footprints behind the sidewalks (x0, x1, z0, z1) — facades at |x| = 10.2 */
export const ARENA_BLOCKS: ReadonlyArray<readonly [number, number, number, number]> = [
  [10.2, 22, -36, 6.0],
  [10.2, 36, 15.0, 43],
  [-22, -10.2, -36, 43],
];

/** where each scenario starts the player when no autopilot path overrides it */
export const PLAYER_START = { x: 3.15, z: -40, heading: 0 } as const;

/** a sample passenger for the boarding / pillion checks (?passenger=1) */
export const ARENA_PASSENGER: PassengerProfile = {
  id: 'arena-ploy', name: 'Ploy', origin: '방콕 직장인', trait: 'shopper', rating: 4.8,
  look: { skin: P.skin1, shirt: '#f7c928', pants: '#2b3a5c', hair: 'hair_long', hairColor: P.hairBrown },
};
