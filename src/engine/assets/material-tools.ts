import type { ColorRepresentation, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { isMesh, isStandardMaterial } from './material-guards';

/** contract names survive Blender's ".001" suffixes */
export const matchesMaterial = (m: Material, name: string): boolean =>
  m.name === name || (m.name.startsWith(name) && m.name.charCodeAt(name.length) === 46 /* '.' */);


/** visit every material under `root` (each material once) */
export function forEachMaterial(root: Object3D, fn: (m: Material, mesh: Mesh) => void): void {
  const seen = new Set<Material>();
  root.traverse((o) => {
    if (!isMesh(o)) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (seen.has(m)) continue;
      seen.add(m);
      fn(m, o);
    }
  });
}

/** materials under `root` whose name matches the contract name */
export function findMaterials(root: Object3D, name: string): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  forEachMaterial(root, (m) => {
    if (isStandardMaterial(m) && matchesMaterial(m, name)) out.push(m);
  });
  return out;
}

/**
 * Recolour every material named `materialName` (sRGB hex/colour). On an `Assets.shared()` clone this changes
 * every clone sharing the template — use `Assets.instance()` for per-object colours. Returns the count changed.
 */
export function setColor(root: Object3D, materialName: string, color: ColorRepresentation): number {
  const mats = findMaterials(root, materialName);
  for (const m of mats) m.color.set(color);
  return mats.length;
}

/** set emissive colour + intensity (0 turns it off) on every material named `materialName` */
export function setEmissive(root: Object3D, materialName: string, color: ColorRepresentation, intensity: number): number {
  const mats = findMaterials(root, materialName);
  for (const m of mats) {
    m.emissive.set(color);
    m.emissiveIntensity = intensity;
  }
  return mats.length;
}

/** only change emissive intensity (keeps the authored emissive colour) */
export function setEmissiveIntensity(root: Object3D, materialName: string, intensity: number): number {
  const mats = findMaterials(root, materialName);
  for (const m of mats) m.emissiveIntensity = intensity;
  return mats.length;
}

/** first descendant with this node name (GLTF node names are kept as authored) */
export function findNode(root: Object3D, name: string): Object3D | null {
  return root.getObjectByName(name) ?? null;
}

/** show/hide shadow casting for a whole subtree (e.g. tiny props, interior glow) */
export function setShadows(root: Object3D, cast: boolean, receive: boolean): void {
  root.traverse((o) => {
    if (!isMesh(o)) return;
    o.castShadow = cast;
    o.receiveShadow = receive;
  });
}
