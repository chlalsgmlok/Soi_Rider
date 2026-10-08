import type { Material, Mesh, MeshStandardMaterial, Object3D } from 'three';

/**
 * Type guards based on three.js `is*` flags instead of `instanceof`, so objects created by a second copy of
 * three (e.g. a GLTFLoader pre-bundled separately by the dev server) are still recognised.
 */
export const isStandardMaterial = (m: Material | null | undefined): m is MeshStandardMaterial =>
  (m as MeshStandardMaterial | null | undefined)?.isMeshStandardMaterial === true;

export const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true;

export const isInstancedMesh = (o: Object3D): boolean =>
  (o as Object3D & { isInstancedMesh?: boolean }).isInstancedMesh === true;
