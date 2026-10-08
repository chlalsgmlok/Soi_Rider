import type { MeshBuilder } from './mesh-builder';

/**
 * Low-poly squashed ellipsoid (smooth normals, flattened bottom) — clipped shrubs, far-tree canopies.
 * `segs` around, `rings` from the flat base to the top pole, in the builder's current colour / kind.
 */
export function blob(mb: MeshBuilder, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, segs = 8, rings = 3): void {
  const base = -0.45;
  const rows: number[][] = [];
  for (let r = 0; r < rings; r++) {
    const lat = (base + ((1 - base) * r) / rings) * (Math.PI / 2);
    const row: number[] = [];
    for (let k = 0; k < segs; k++) {
      const lon = (k / segs) * Math.PI * 2;
      const nx = Math.cos(lat) * Math.cos(lon);
      const ny = Math.sin(lat);
      const nz = Math.cos(lat) * Math.sin(lon);
      const l = Math.hypot(nx / rx, ny / ry, nz / rz);
      row.push(mb.vert(cx + nx * rx, cy + ny * ry, cz + nz * rz, nx / rx / l, ny / ry / l, nz / rz / l));
    }
    rows.push(row);
  }
  const top = mb.vert(cx, cy + ry, cz, 0, 1, 0);
  const bottom = mb.vert(cx, cy + Math.sin((base * Math.PI) / 2) * ry, cz, 0, -1, 0);
  for (let r = 0; r + 1 < rows.length; r++) {
    for (let k = 0; k < segs; k++) {
      const k1 = (k + 1) % segs;
      mb.tri(rows[r][k], rows[r + 1][k], rows[r + 1][k1]);
      mb.tri(rows[r][k], rows[r + 1][k1], rows[r][k1]);
    }
  }
  const last = rows[rows.length - 1];
  const first = rows[0];
  for (let k = 0; k < segs; k++) {
    const k1 = (k + 1) % segs;
    mb.tri(last[k], top, last[k1]);
    mb.tri(first[k], first[k1], bottom);
  }
}
