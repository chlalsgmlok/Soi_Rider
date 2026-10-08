import type { MeshStandardMaterial } from 'three';

/**
 * Per-vertex behaviour codes of the city "uber" batch (aKind = tint + 8 · emissive class).
 * Tint: which per-instance palette channel recolours the vertex, or a vertex animation.
 */
export const TINT = { none: 0, ch1: 1, ch2: 2, ch3: 3, shutter: 4, sway: 5, cable: 6 } as const;

/** Emissive classes; their colour × strength is a uniform array driven by time of day (city-material.ts). */
export const EMIS = { none: 0, window: 1, interior: 2, lamp: 3, neon: 4, aviation: 5, head: 6, tail: 7 } as const;

const SHOPHOUSE = { Wall: TINT.ch1, Wall2: TINT.ch2, Awning_A: TINT.ch3, Shutter: TINT.shutter };
const FOLIAGE = { Leaf: TINT.sway, Leaf2: TINT.sway, Flower: TINT.sway };

/** asset → contract material → tint channel (data table) */
const TINT_RULES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  bld_shophouse_2f: SHOPHOUSE,
  bld_shophouse_3f: SHOPHOUSE,
  bld_shophouse_4f: SHOPHOUSE,
  bld_minimart: { Paint: TINT.ch1, Paint2: TINT.ch2 },
  prop_stool: { Plastic: TINT.ch1 },
  prop_umbrella: { Canvas: TINT.ch1 },
  prop_food_cart: { Canvas: TINT.ch1 },
  prop_barrier: { Paint: TINT.ch1 },
  prop_palm: FOLIAGE,
  prop_raintree: FOLIAGE,
  prop_banana: FOLIAGE,
  prop_bougainvillea: FOLIAGE,
};

const EMISSIVE_BY_NAME: Readonly<Record<string, number>> = {
  Window: EMIS.window,
  Interior_Light: EMIS.interior,
  Lamp_Glow: EMIS.lamp,
  Bld_Neon: EMIS.neon,
  Bld_AviationLamp: EMIS.aviation,
  Light_Head: EMIS.head,
  Light_Tail: EMIS.tail,
};

/** contract name without Blender's ".001" suffix */
export const baseMaterialName = (name: string): string => {
  const dot = name.indexOf('.');
  return dot < 0 ? name : name.slice(0, dot);
};

export function tintOf(asset: string, material: string): number {
  return TINT_RULES[asset]?.[material] ?? TINT.none;
}

export function emissiveOf(m: MeshStandardMaterial): number {
  const byName = EMISSIVE_BY_NAME[baseMaterialName(m.name)];
  if (byName !== undefined) return byName;
  const e = m.emissive;
  return (e.r + e.g + e.b) * m.emissiveIntensity > 0.03 ? EMIS.neon : EMIS.none;
}

export const kindCode = (tint: number, emissive: number): number => tint + 8 * emissive;

/** foliage and bark read best without specular (their thin edges would sparkle at grazing angles) */
const MATTE: ReadonlySet<string> = new Set(['Leaf', 'Leaf2', 'Flower', 'Trunk', 'Trunk2', 'Soil', 'Cable']);
/** metalness written for matte materials (decoded by the uber shader) */
export const MATTE_METAL = -1;
export const isMatte = (material: string): boolean => MATTE.has(material);

/** Sign_Face quads become canvas-atlas signs; the train's route board stays a painted colour */
export const isSignMaterial = (asset: string, material: string): boolean => material === 'Sign_Face' && asset !== 'bts_train';

/** traffic-light lenses are driven per phase by the signal system */
export const SIGNAL_LAMPS = { lamp_red: 'red', lamp_amber: 'amber', lamp_green: 'green' } as const;
