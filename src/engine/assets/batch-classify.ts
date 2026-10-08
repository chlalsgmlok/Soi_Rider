import type { Material, MeshStandardMaterial } from 'three';
import { isStandardMaterial } from './material-guards';

/**
 * Contract materials the game drives at runtime (emissive at night, canvas text, signals, brake lights).
 * They always keep their own material inside a static batch so `setEmissive(batch, name, …)` keeps working.
 */
export const RUNTIME_MATERIALS: ReadonlySet<string> = new Set([
  'Window', 'Lamp_Glow', 'Interior_Light', 'Light_Head', 'Light_Tail', 'Light_Brake', 'Sign_Face', 'Sign_Taxi',
  'Signal_Red', 'Signal_Amber', 'Signal_Green', 'Dash_Screen', 'Gear_Logo',
]);

/** contract name without Blender's ".001" suffix */
export const baseName = (name: string): string => {
  const dot = name.indexOf('.');
  return dot < 0 ? name : name.slice(0, dot);
};

const emissiveLuma = (m: MeshStandardMaterial): number =>
  (m.emissive.r * 0.2126 + m.emissive.g * 0.7152 + m.emissive.b * 0.0722) * m.emissiveIntensity;

/**
 * Plain painted surfaces: opaque, untextured, not emissive, not runtime-driven. These can be folded into one
 * vertex-coloured material per roughness/metalness bucket.
 */
export function isColorMergeable(m: Material): m is MeshStandardMaterial {
  if (!isStandardMaterial(m) || !m.visible || m.transparent || m.vertexColors) return false;
  if (m.map || m.emissiveMap || m.alphaMap || m.normalMap || m.roughnessMap || m.metalnessMap || m.aoMap) return false;
  if (m.alphaTest > 0 || emissiveLuma(m) > 1e-4) return false;
  return !RUNTIME_MATERIALS.has(baseName(m.name));
}

/** merged-material bucket: surfaces with the same response to light */
export function bucketKey(m: MeshStandardMaterial): string {
  return `${Math.round(m.roughness * 10)}|${Math.round(m.metalness * 4)}|${m.side}|${m.flatShading ? 'f' : 's'}`;
}

/** materials that look identical can share one draw call */
export function materialKey(m: Material): string {
  if (isStandardMaterial(m)) {
    return [m.type, m.name, m.color.getHexString(), m.emissive.getHexString(), m.emissiveIntensity.toFixed(3),
      m.roughness.toFixed(3), m.metalness.toFixed(3), m.transparent ? m.opacity.toFixed(3) : '1', m.side,
      m.map?.uuid ?? '-', m.vertexColors ? 'vc' : ''].join('|');
  }
  return m.uuid;
}
