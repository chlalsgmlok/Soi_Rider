/**
 * Runtime colour tokens (sRGB hex) — the same values as blender/lib/palette.py and src/ui/styles/tokens.css.
 * Keep the three in sync; this file is the TypeScript source of truth.
 */
export const PALETTE = {
  gramCyan: '#3EE6D4',
  gramCyanDeep: '#12B5A6',
  pinCoral: '#FF4D5E',
  ink: '#151821',
  cream: '#FFF6E8',
  sun: '#FFC46B',
  amber: '#FFB23E',

  taxiPink: '#F2559A',
  taxiGreen: '#34B04A',
  taxiYellow: '#F7C928',
  taxiBlue: '#2F6FD6',
  taxiOrange: '#FF8A2A',
  taxiRed: '#E23C3C',
  tuktukBlue: '#2C56B8',
  vanWhite: '#F3F0E8',
  busRed: '#D8343A',
  busCream: '#F1E6CF',
  carSilver: '#C9CDD3',
  carBlack: '#2A2C31',
  carWhite: '#F2F2F0',
  carBeige: '#D9C7A5',
  carNavy: '#2B3A5C',
  carMaroon: '#7A2A35',

  asphalt: '#6E6762',
  asphaltWet: '#4A4644',
  laneWhite: '#F4F1E8',
  laneYellow: '#F2C230',
  curbRed: '#D9473E',
  curbWhite: '#F3EEE3',
  sidewalk: '#CDBFAE',
  concrete: '#B9B2A8',

  wallCream: '#EED9B2',
  wallSalmon: '#F2B8A0',
  wallMint: '#9FD3C7',
  wallLemon: '#F4E27A',
  wallPowder: '#C9D6E8',
  wallPink: '#E7C1D8',
  wallWhite: '#F4F0E8',
  awningRed: '#E24B3B',
  awningGreen: '#3E9D5A',
  awningBlue: '#3F7FD0',
  leaf: '#4FA33F',
  leafDark: '#2F7A35',
  bougainvillea: '#EC4F9C',

  neonPink: '#FF4FA3',
  neonCyan: '#3EE6D4',
  neonYellow: '#FFE14D',
  neonRed: '#FF3B3B',
  signBlue: '#2457A6',

  skin1: '#F1C9A5',
  skin2: '#D9A47A',
  skin3: '#B9805A',
  skin4: '#8D5A3B',
  hairBlack: '#1E1B1A',
  hairBrown: '#5A3A28',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Colours offered for player customisation (catalog colour items reference these). */
export const CUSTOM_COLORS: ReadonlyArray<{ key: string; name: string; hex: string }> = [
  { key: 'taxi_pink', name: '택시 핑크', hex: PALETTE.taxiPink },
  { key: 'gram_cyan', name: '그램 시안', hex: PALETTE.gramCyan },
  { key: 'mango', name: '망고 옐로', hex: PALETTE.taxiYellow },
  { key: 'tuk_blue', name: '뚝뚝 블루', hex: PALETTE.tuktukBlue },
  { key: 'leaf_green', name: '바나나 그린', hex: PALETTE.taxiGreen },
  { key: 'chili_red', name: '칠리 레드', hex: PALETTE.taxiRed },
  { key: 'thai_tea', name: '타이티 오렌지', hex: PALETTE.taxiOrange },
  { key: 'jasmine', name: '자스민 화이트', hex: PALETTE.carWhite },
  { key: 'night_ink', name: '나이트 잉크', hex: PALETTE.carBlack },
  { key: 'lotus', name: '로터스 핑크', hex: PALETTE.wallPink },
  { key: 'temple_gold', name: '사원 골드', hex: '#E8B640' },
  { key: 'neon_purple', name: '네온 퍼플', hex: '#8A5BFF' },
];
