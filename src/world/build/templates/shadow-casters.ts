import { type BatchedMesh, FrontSide, ShaderMaterial } from 'three';
import { type BatchItem, buildBatch } from '../kit/batch';

/** street clutter too small to matter in the sun's shadow map */
const NO_SHADOW: ReadonlySet<string> = new Set([
  'prop_stool', 'prop_cone', 'prop_pot_plant', 'prop_crates', 'prop_ice_box', 'prop_bin', 'prop_hydrant', 'prop_table',
]);

export const castsShadow = (asset: string): boolean => !NO_SHADOW.has(asset);

/**
 * Colour pass of the caster batch: every vertex lands outside the clip volume (one draw, zero fragments). The shadow
 * pass ignores this material and renders the batch with three's batching depth material.
 */
const proxy = new ShaderMaterial({
  name: 'City_ShadowCasters',
  vertexShader: 'void main() { gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 ); }',
  fragmentShader: 'void main() { gl_FragColor = vec4( 0.0 ); }',
  side: FrontSide,
  depthWrite: false,
});

/**
 * Sun-shadow casters for the city as their own BatchedMesh: buildings, towers and trees cast with their low-detail
 * stand-ins (same silhouette, a fraction of the vertices), tiny clutter not at all — the full-detail batch then
 * skips the shadow pass entirely.
 */
export function buildShadowCasters(items: readonly BatchItem[]): BatchedMesh | null {
  const batch = buildBatch('city_shadow_casters', items, proxy, { castShadow: true, receiveShadow: false });
  if (!batch) return null;
  batch.mesh.frustumCulled = false;
  return batch.mesh;
}
