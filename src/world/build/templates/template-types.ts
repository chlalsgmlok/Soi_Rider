import type { Box3, BufferGeometry, Vector3 } from 'three';

export type LampColor = 'red' | 'amber' | 'green';

/**
 * A Sign_Face part of a model in template space: triangles with the authored 0..1 UVs
 * (u → viewer's right, v → up), remapped into the sign atlas per instance.
 */
export interface SignPart {
  /** node name (signboard, sign_face, screen, countdown) */
  node: string;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  index: Uint32Array;
  /** world-size of the face (u extent, v extent) in metres — the atlas cell keeps this aspect */
  width: number;
  height: number;
}

/** Everything the city view needs from one GLB, converted once and shared by every instance. */
export interface BakedTemplate {
  name: string;
  /** uber-format geometry (template space, +Z = forward / street side) incl. the building plinth */
  geometry: BufferGeometry;
  /** transparent parts (glass-format), or null */
  glass: BufferGeometry | null;
  signs: SignPart[];
  /** traffic-light lenses (position + normal), template space */
  lamps: Partial<Record<LampColor, BufferGeometry>>;
  /** named empties (wire_0…3, lamp, …) in template space */
  anchors: Map<string, Vector3>;
  bounds: Box3;
  /** roller shutter top / bottom (y) on shophouses */
  shutter: [number, number] | null;
}
