import { CHUNK } from './dims';
import { MeshBuilder } from './mesh-builder';

/**
 * Static geometry binned by CHUNK × CHUNK squares: callers ask for the builder of the chunk that contains a piece's
 * centre, so each chunk ends up as one tight, frustum-cullable geometry.
 */
export class ChunkSet {
  private readonly map = new Map<string, MeshBuilder>();

  constructor(readonly size = CHUNK) {}

  at(x: number, z: number): MeshBuilder {
    const key = `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`;
    let mb = this.map.get(key);
    if (!mb) {
      mb = new MeshBuilder();
      this.map.set(key, mb);
    }
    return mb;
  }

  /** non-empty chunk builders */
  builders(): MeshBuilder[] {
    return [...this.map.values()].filter((b) => !b.isEmpty);
  }

  get count(): number {
    return this.builders().length;
  }
}
