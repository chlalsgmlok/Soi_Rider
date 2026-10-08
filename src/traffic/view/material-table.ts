/**
 * How each contract material of an NPC model is drawn by the merged rig material (docs/ASSET_SPEC.md names):
 * `slot` picks a per-instance tint (0 = keep the authored colour, 1..4 = tint A..D), `glow` picks how its
 * emission is driven per instance.
 */
export type GlowChannel = 'static' | 'brake' | 'indicator' | 'night';

/** glow channel ids as stored in the vertex attribute (indicator splits into left 2 / right 3 by vertex side) */
export const GLOW_ID = { static: 0, brake: 1, left: 2, right: 3, night: 4 } as const;

export interface MaterialRole {
  slot: 0 | 1 | 2 | 3 | 4;
  glow: GlowChannel;
  /** emission colour × strength used by the channel (linear RGB); null = the material's authored emissive */
  glowColor: readonly [number, number, number] | null;
}

const KEEP: MaterialRole = { slot: 0, glow: 'static', glowColor: null };

/** brake lamps go from dark red to a bloom-bright red when braking */
const BRAKE: MaterialRole = { slot: 0, glow: 'brake', glowColor: [2.6, 0.08, 0.05] };
const INDICATOR: MaterialRole = { slot: 0, glow: 'indicator', glowColor: [2.4, 0.9, 0.08] };
const NIGHT: MaterialRole = { slot: 0, glow: 'night', glowColor: null };

/** vehicles (cars, tuk-tuks, buses, motorbikes): Paint → A, Paint2 → B */
export const VEHICLE_ROLES: Readonly<Record<string, MaterialRole>> = {
  Paint: { slot: 1, glow: 'static', glowColor: null },
  Paint2: { slot: 2, glow: 'static', glowColor: null },
  Light_Brake: BRAKE,
  Light_Amber: INDICATOR,
  Light_Indicator: INDICATOR,
  Indicator: INDICATOR,
  Light_Head: NIGHT,
  Light_Tail: NIGHT,
  Sign_Taxi: NIGHT,
  Sign_Face: { slot: 0, glow: 'night', glowColor: [0.35, 0.33, 0.28] },
};

/**
 * char_body: Skin/Hands → A (skin), Shirt → B, Pants → C, Hair → D. Shoes share D: dark hair → dark shoes for most
 * people, while monks (hair = skin, shaved) walk barefoot.
 */
export const BODY_ROLES: Readonly<Record<string, MaterialRole>> = {
  Skin: { slot: 1, glow: 'static', glowColor: null },
  Hands: { slot: 1, glow: 'static', glowColor: null },
  Shirt: { slot: 2, glow: 'static', glowColor: null },
  Pants: { slot: 3, glow: 'static', glowColor: null },
  Hair: { slot: 4, glow: 'static', glowColor: null },
  Shoes: { slot: 4, glow: 'static', glowColor: null },
};

/** attachments: their main recolourable material → A */
export const ATTACHMENT_ROLES: Readonly<Record<string, MaterialRole>> = {
  Hair: { slot: 1, glow: 'static', glowColor: null },
  Hat: { slot: 1, glow: 'static', glowColor: null },
  Helmet_Paint: { slot: 1, glow: 'static', glowColor: null },
  Outfit_Paint: { slot: 1, glow: 'static', glowColor: null },
  Poncho: { slot: 1, glow: 'static', glowColor: null },
  Canvas: { slot: 1, glow: 'static', glowColor: null },
};

/** contract name without Blender's ".001" suffix */
export function contractName(name: string): string {
  const dot = name.indexOf('.');
  return dot < 0 ? name : name.slice(0, dot);
}

export function roleOf(table: Readonly<Record<string, MaterialRole>>, materialName: string): MaterialRole {
  return table[contractName(materialName)] ?? KEEP;
}
