import { PALETTE } from '../../../core/config/palette';
import type { DistrictId } from '../../../core/types';

/** surface pattern ids (aGround attribute) evaluated in world space by the ground shader */
export const G = {
  asphalt: 0,
  gutter: 1,
  tiles: 2,
  curb: 3,
  pavers: 4,
  slabs: 5,
  lot: 6,
  lawn: 7,
  soil: 8,
  concrete: 9,
} as const;

export interface GroundStyle {
  asphalt: string;
  gutter: string;
  tiles: string;
  pavers: string;
  slabs: string;
  lot: string;
  lawn: string;
  soil: string;
  concrete: string;
  curb: readonly [string, string];
  medianCurb: readonly [string, string];
  /** yellow-white curbs beside bus stops */
  busCurb: readonly [string, string];
}

/** sidewalk tile tint per district (Yaowarat's terracotta pavers, Siam's pale granite …) */
const TILES: Readonly<Record<DistrictId, string>> = {
  sukhumvit: '#CDBFAE',
  siam: '#D4CEC4',
  yaowarat: '#C9A797',
  khaosan: '#CDBA9F',
  silom: '#C8BCAC',
};

export function groundStyle(district: DistrictId): GroundStyle {
  return {
    asphalt: PALETTE.asphalt,
    gutter: '#ABA498',
    tiles: TILES[district],
    pavers: '#B8A895',
    slabs: '#DCD0BD',
    lot: '#8F8B73',
    lawn: '#73A548',
    soil: '#6E8F40',
    concrete: PALETTE.concrete,
    curb: [PALETTE.curbRed, PALETTE.curbWhite],
    medianCurb: ['#2C2C30', '#EFEBE2'],
    busCurb: [PALETTE.laneYellow, PALETTE.curbWhite],
  };
}
