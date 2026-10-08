import { type BufferGeometry, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { baseName, isColorMergeable } from '../../engine/assets/batch-classify';
import { colorBaked } from '../../engine/assets/batch-geometry';
import { isMesh, isStandardMaterial } from '../../engine/assets/material-guards';
import type { Assets } from '../../engine/assets/assets';
import { toonify } from '../../engine/env/toonify';

/** contract materials the rig recolours, swaps or lights at runtime — never folded */
const LIVE = new Set([
  'Paint', 'Paint2', 'Light_Head', 'Light_Tail', 'Light_Brake', 'Dash_Screen', 'Glass', 'Helmet_Paint', 'Outfit_Paint',
  'Gear_Paint', 'Gear_Logo', 'Shirt', 'Skin', 'Hands', 'Pants', 'Hair', 'Hat', 'Poncho', 'Poncho_Snap', 'Mask', 'Visor',
]);
/** parts smaller than this (bounding radius, m) do not cast shadows — eyes, buttons, plates */
const TINY = 0.05;

const foldable = (m: Mesh): m is Mesh<BufferGeometry, MeshStandardMaterial> =>
  !Array.isArray(m.material) && isStandardMaterial(m.material) && isColorMergeable(m.material) &&
  !LIVE.has(baseName(m.material.name)) && !m.morphTargetInfluences && m.position.lengthSq() === 0 &&
  m.quaternion.w === 1 && m.scale.x === 1 && m.scale.y === 1 && m.scale.z === 1;

/**
 * Cuts the player rig's draw calls: glTF splits a multi-material node into sibling primitive meshes; their plain,
 * fixed-colour primitives (trim, chrome, rubber, eyes, soles…) are folded into one vertex-coloured mesh per node
 * and light bucket (metal / matte), and tiny parts stop casting shadows. Call once colours are final (idempotent). The merged
 * geometry is owned by the rig: release such objects with `releasePart`.
 */
export function mergeParts(root: Object3D): Mesh[] {
  const created: Mesh[] = [];
  const groups: Object3D[] = [];
  root.traverse((o) => {
    if (!isMesh(o) && o.children.filter(isMesh).length >= 2) groups.push(o);
  });
  for (const g of groups) {
    const buckets = new Map<string, Array<Mesh<BufferGeometry, MeshStandardMaterial>>>();
    for (const c of g.children) {
      if (!isMesh(c) || !foldable(c)) continue;
      // two light buckets per node: metal (chrome, steel) and everything else (rubber, plastic, trim, eyes)
      const key = `${c.material.metalness > 0.5 ? 'metal' : 'matte'}|${c.material.side}`;
      const list = buckets.get(key) ?? [];
      list.push(c);
      buckets.set(key, list);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const merged = mergeGeometries(list.map((m) => colorBaked(m.geometry, m.material.color)), false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      // area-ish weighting: the bigger primitives decide how the merged surface catches the light
      let w = 0;
      let rough = 0;
      let metal = 0;
      for (const m of list) {
        const n = m.geometry.getAttribute('position').count;
        w += n;
        rough += m.material.roughness * n;
        metal += m.material.metalness * n;
      }
      const mat = toonify(new MeshStandardMaterial({
        name: 'Rig_Merged', vertexColors: true, roughness: rough / w, metalness: metal / w, side: list[0].material.side,
      }));
      const mesh = new Mesh(merged, mat);
      mesh.name = `${g.name}_merged`;
      mesh.userData.rigMerged = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      for (const m of list) {
        m.removeFromParent();
        m.material.dispose();
      }
      g.add(mesh);
      created.push(mesh);
    }
  }
  root.traverse((o) => {
    if (!isMesh(o)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if ((o.geometry.boundingSphere?.radius ?? 1) < TINY) o.castShadow = false;
  });
  return created;
}

/** Assets.release + the geometry mergeParts created inside `obj` (Assets only disposes materials) */
export function releasePart(assets: Assets, obj: Object3D): void {
  obj.traverse((o) => {
    if (isMesh(o) && o.userData.rigMerged === true) o.geometry.dispose();
  });
  assets.release(obj);
}
