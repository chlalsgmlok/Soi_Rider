import { type Material, MeshStandardMaterial } from 'three';
import { PALETTE as P } from '../../../core/config/palette';

interface MatSpec {
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

/** Default look of every contract material name (docs/ASSET_SPEC.md) for placeholder stand-ins. */
const SPECS: Record<string, MatSpec> = {
  Paint: { color: P.taxiPink, roughness: 0.35 },
  Paint2: { color: P.taxiPink, roughness: 0.35 },
  Trim: { color: '#2a2d33', roughness: 0.6 },
  Glass: { color: '#2b3a48', roughness: 0.12 },
  Tire: { color: '#25272b', roughness: 0.85 },
  Chrome: { color: '#d7dce2', roughness: 0.22, metalness: 1 },
  Seat: { color: '#1f2125', roughness: 0.7 },
  Light_Head: { color: '#fff3c9', emissive: '#fff3c9', emissiveIntensity: 2.2, roughness: 0.2 },
  Light_Tail: { color: '#ff2b2b', emissive: '#ff2b2b', emissiveIntensity: 0.8, roughness: 0.3 },
  Light_Brake: { color: '#c81e1e', roughness: 0.3 },
  Plate: { color: '#f6d23a', roughness: 0.5 },
  Dash_Screen: { color: '#10161c', emissive: '#3ee6d4', emissiveIntensity: 0.25, roughness: 0.3 },
  Skin: { color: P.skin2, roughness: 0.7 },
  Hands: { color: P.skin2, roughness: 0.7 },
  Shirt: { color: '#f3f1ec', roughness: 0.8 },
  Pants: { color: '#3a4f78', roughness: 0.8 },
  Shoes: { color: '#2a2a2e', roughness: 0.7 },
  Hair: { color: P.hairBlack, roughness: 0.8 },
  Hat: { color: '#3c6fd1', roughness: 0.7 },
  Helmet_Paint: { color: P.carWhite, roughness: 0.3 },
  Helmet_Trim: { color: '#2a2d33', roughness: 0.5 },
  Visor: { color: '#2f3640', roughness: 0.1 },
  Outfit_Paint: { color: P.taxiOrange, roughness: 0.75 },
  Outfit_Trim: { color: '#e8eef2', roughness: 0.4 },
  Poncho: { color: '#f7d33a', roughness: 0.35 },
  Mask: { color: '#e9f2f6', roughness: 0.8 },
  Gear_Paint: { color: P.gramCyan, roughness: 0.5 },
  Gear_Logo: { color: '#ffffff', roughness: 0.5 },
  Wall: { color: P.wallCream, roughness: 0.85 },
  Wall2: { color: P.wallSalmon, roughness: 0.85 },
  Window: { color: '#41566a', roughness: 0.2, emissive: '#ffcf8a', emissiveIntensity: 0 },
  Shutter: { color: '#a9b0b6', roughness: 0.6, metalness: 0.3 },
  Awning_A: { color: P.awningRed, roughness: 0.75 },
  Awning_B: { color: '#f4f0e8', roughness: 0.75 },
  Sign_Face: { color: P.cream, roughness: 0.6 },
  Sign_Taxi: { color: P.cream, emissive: '#fff1c4', emissiveIntensity: 0.6, roughness: 0.4 },
  Interior_Light: { color: '#ffd9a0', emissive: '#ffc070', emissiveIntensity: 1.4, roughness: 0.9 },
  Plastic: { color: '#e24b3b', roughness: 0.5 },
  Canvas: { color: '#e24b3b', roughness: 0.8 },
  Canopy: { color: '#2a2f3a', roughness: 0.6 },
  Leaf: { color: P.leaf, roughness: 0.8 },
  Leaf2: { color: P.leafDark, roughness: 0.8 },
  Flower: { color: P.bougainvillea, roughness: 0.7 },
  Signal_Red: { color: '#ff3b3b', emissive: '#ff3b3b', emissiveIntensity: 0.4, roughness: 0.3 },
  Signal_Amber: { color: '#ffaa2b', emissive: '#ffaa2b', emissiveIntensity: 0.4, roughness: 0.3 },
  Signal_Green: { color: '#2fe07a', emissive: '#2fe07a', emissiveIntensity: 0.4, roughness: 0.3 },
  Lamp_Glow: { color: '#ffe3b0', emissive: '#ffd08a', emissiveIntensity: 0, roughness: 0.3 },
  Concrete: { color: P.concrete, roughness: 0.9 },
  Metal: { color: '#8f98a3', roughness: 0.45, metalness: 0.6 },
  Wood: { color: '#8c5a3c', roughness: 0.8 },
  Trunk: { color: '#7a5a40', roughness: 0.9 },
  Pot: { color: '#c76b45', roughness: 0.8 },
  Gold: { color: '#e8b640', roughness: 0.3, metalness: 0.8 },
  Roof: { color: '#c8573e', roughness: 0.6 },
  Roof2: { color: '#2f8a4c', roughness: 0.6 },
  Ice: { color: '#3f7fd0', roughness: 0.5 },
  Stripe_Red: { color: P.curbRed, roughness: 0.6 },
  Stripe_White: { color: P.curbWhite, roughness: 0.6 },
};

const FALLBACK: MatSpec = { color: '#b9b2a8', roughness: 0.7 };

export function placeholderMaterial(name: string, colorOverride?: string): Material {
  const s = SPECS[name] ?? FALLBACK;
  const m = new MeshStandardMaterial({
    name,
    color: colorOverride ?? s.color,
    roughness: s.roughness ?? 0.6,
    metalness: s.metalness ?? 0,
  });
  if (s.emissive) {
    m.emissive.set(s.emissive);
    m.emissiveIntensity = s.emissiveIntensity ?? 1;
  }
  return m;
}
