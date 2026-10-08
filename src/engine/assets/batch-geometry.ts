import { BufferAttribute, BufferGeometry, type Color } from 'three';

/** give a non-indexed geometry a trivial index so it can merge with indexed ones */
export function ensureIndexed(g: BufferGeometry): BufferGeometry {
  if (g.index) return g;
  const n = g.getAttribute('position').count;
  const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}

/**
 * position + normal + per-vertex colour (linear) — the layout of every vertex-colour-merged static batch.
 * `g` must already be in world space; the source geometry is left untouched.
 */
export function colorBaked(g: BufferGeometry, color: Color): BufferGeometry {
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const out = new BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  out.setAttribute('normal', g.getAttribute('normal'));
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = color.r;
    c[i * 3 + 1] = color.g;
    c[i * 3 + 2] = color.b;
  }
  out.setAttribute('color', new BufferAttribute(c, 3));
  if (g.index) out.setIndex(g.index);
  return ensureIndexed(out);
}

/** positions only (shadow proxies never need normals/uvs) */
export function positionsOnly(g: BufferGeometry): BufferGeometry {
  const out = new BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  if (g.index) out.setIndex(g.index);
  return ensureIndexed(out);
}
