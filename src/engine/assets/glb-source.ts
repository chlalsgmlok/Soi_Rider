import type { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GLTF_MAGIC = 0x46546c67; // 'glTF' little-endian

/** default model folder (Vite serves public/ at the base URL) */
export const MODEL_BASE = `${import.meta.env.BASE_URL}assets/models/`;

/**
 * Fetch + parse one GLB. Returns null when the file does not exist yet (404 or the dev server's HTML fallback),
 * so callers can fall back to a placeholder without console noise. Real parse errors are reported.
 */
export async function loadGlb(loader: GLTFLoader, baseUrl: string, name: string): Promise<Group | null> {
  let buf: ArrayBuffer;
  try {
    const res = await fetch(`${baseUrl}${name}.glb`);
    if (!res.ok) return null;
    if ((res.headers.get('content-type') ?? '').includes('text/html')) return null;
    buf = await res.arrayBuffer();
  } catch {
    return null;
  }
  if (buf.byteLength < 12 || new DataView(buf).getUint32(0, true) !== GLTF_MAGIC) return null;
  try {
    const gltf = await loader.parseAsync(buf, baseUrl);
    gltf.scene.name = name;
    return gltf.scene;
  } catch (err) {
    console.error(`[assets] ${name}.glb failed to parse — using placeholder`, err);
    return null;
  }
}
