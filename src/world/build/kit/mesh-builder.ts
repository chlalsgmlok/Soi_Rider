import { BufferAttribute, BufferGeometry, Color, type ColorRepresentation } from 'three';

/**
 * Vertex layouts used by the city batches:
 *  uber   — position, normal, color, aKind (tint + 8·emissive class), aSurf (roughness, metalness)
 *  ground — position, normal, color, aGround (surface pattern id)
 *  decal  — position, normal, uv (atlas-textured markings / signs)
 *  glass  — position, normal, color
 *  sign   — position, normal, uv, color (board colour), aGlow (sign lighting mode)
 */
export type VertexFormat = 'uber' | 'ground' | 'decal' | 'glass' | 'sign';

export type P3 = readonly [number, number, number];

const e1 = [0, 0, 0];
const e2 = [0, 0, 0];

/**
 * Accumulates indexed triangles with a "current" colour / kind / surface state (immediate-mode style), then emits a
 * BufferGeometry in one of the batch vertex formats. Quads are re-wound so they always face their given normal.
 */
export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly col: number[] = [];
  private readonly uvs: number[] = [];
  private readonly kinds: number[] = [];
  private readonly surfs: number[] = [];
  private readonly idx: number[] = [];
  private readonly c = new Color(1, 1, 1);
  private k = 0;
  private rough = 0.8;
  private metal = 0;

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get isEmpty(): boolean {
    return this.idx.length === 0;
  }

  /** current vertex colour (sRGB input → linear) */
  color(c: ColorRepresentation): this {
    this.c.set(c);
    return this;
  }

  /** current vertex colour already in linear space */
  linear(r: number, g: number, b: number): this {
    this.c.setRGB(r, g, b);
    return this;
  }

  kind(k: number): this {
    this.k = k;
    return this;
  }

  surf(roughness: number, metalness = 0): this {
    this.rough = roughness;
    this.metal = metalness;
    return this;
  }

  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u = 0, v = 0): number {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.col.push(this.c.r, this.c.g, this.c.b);
    this.uvs.push(u, v);
    this.kinds.push(this.k);
    this.surfs.push(this.rough, this.metal);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /**
   * Quad p0-p1-p2-p3 (around the rim) facing normal n; uv rect [u0, v0, u1, v1] maps p0→(u0,v0), p1→(u1,v0),
   * p2→(u1,v1), p3→(u0,v1).
   */
  quad(p0: P3, p1: P3, p2: P3, p3: P3, n: P3, uv: readonly number[] = [0, 0, 1, 1]): void {
    const [u0, v0, u1, v1] = uv;
    const a = this.vert(p0[0], p0[1], p0[2], n[0], n[1], n[2], u0, v0);
    const b = this.vert(p1[0], p1[1], p1[2], n[0], n[1], n[2], u1, v0);
    const c = this.vert(p2[0], p2[1], p2[2], n[0], n[1], n[2], u1, v1);
    const d = this.vert(p3[0], p3[1], p3[2], n[0], n[1], n[2], u0, v1);
    for (let i = 0; i < 3; i++) {
      e1[i] = p1[i] - p0[i];
      e2[i] = p2[i] - p0[i];
    }
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) this.idx.push(a, b, c, a, c, d);
    else this.idx.push(a, c, b, a, d, c);
  }

  toGeometry(format: VertexFormat): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    if (format !== 'decal') g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    if (format === 'decal' || format === 'sign') g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    if (format === 'sign') g.setAttribute('aGlow', new BufferAttribute(new Float32Array(this.kinds), 1));
    if (format === 'uber') {
      g.setAttribute('aKind', new BufferAttribute(new Float32Array(this.kinds), 1));
      g.setAttribute('aSurf', new BufferAttribute(new Float32Array(this.surfs), 2));
    }
    if (format === 'ground') g.setAttribute('aGround', new BufferAttribute(new Float32Array(this.kinds), 1));
    const n = this.vertexCount;
    g.setIndex(new BufferAttribute(n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
