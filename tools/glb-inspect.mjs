// Inspect GLB files against docs/ASSET_SPEC.md: node tree, materials, triangle count, bounds (three.js axes, metres).
// Usage: node tools/glb-inspect.mjs public/assets/models/veh_taxi.glb [more.glb ...]
//        node tools/glb-inspect.mjs --all          (every model, one summary line each)
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modelsDir = resolve(root, 'public/assets/models');

function parse(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
}

function mat4FromNode(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const apply = (m, p) => [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);

function inspect(file, verbose) {
  const g = parse(file);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  let tris = 0;
  const lines = [];
  const usedMats = new Set();
  const walk = (idx, parentM, depth) => {
    const n = g.nodes[idx];
    const m = mul(parentM, mat4FromNode(n));
    let info = '';
    if (n.mesh !== undefined) {
      const mesh = g.meshes[n.mesh];
      let t = 0;
      for (const p of mesh.primitives) {
        const count = p.indices !== undefined ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count;
        t += count / 3;
        if (p.material !== undefined) usedMats.add(g.materials[p.material].name);
        const acc = g.accessors[p.attributes.POSITION];
        if (acc.min && acc.max) {
          for (const cx of [acc.min[0], acc.max[0]]) for (const cy of [acc.min[1], acc.max[1]]) for (const cz of [acc.min[2], acc.max[2]]) {
            const w = apply(m, [cx, cy, cz]);
            for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], w[i]); hi[i] = Math.max(hi[i], w[i]); }
          }
        }
      }
      tris += t;
      info = ` mesh tris=${t} mats=[${mesh.primitives.map((p) => (p.material !== undefined ? g.materials[p.material].name : '-')).join(',')}]`;
    }
    const pos = n.translation ? ` @(${n.translation.map((v) => v.toFixed(2)).join(', ')})` : '';
    lines.push(`${'  '.repeat(depth)}- ${n.name}${pos}${info}`);
    for (const c of n.children || []) walk(c, m, depth + 1);
  };
  const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of g.scenes[g.scene || 0].nodes) walk(r, ident, 0);
  const size = hi.map((v, i) => (v - lo[i]).toFixed(2));
  const name = basename(file);
  if (!verbose) {
    console.log(`${name.padEnd(28)} tris=${String(tris).padStart(5)} size(x,y,z)=${size.join('×')} mats=${[...usedMats].join(',')}`);
    return;
  }
  console.log(`# ${name}`);
  console.log(`tris=${tris}  bounds min=(${lo.map((v) => v.toFixed(2))}) max=(${hi.map((v) => v.toFixed(2))})  size x×y×z=${size.join(' × ')}`);
  console.log('three.js axes: +Z forward, +Y up, +X = model LEFT');
  console.log(`materials: ${(g.materials || []).map((mm) => mm.name).join(', ')}`);
  console.log(lines.join('\n'));
}

const args = process.argv.slice(2);
if (args[0] === '--all') {
  for (const f of readdirSync(modelsDir).filter((f) => f.endsWith('.glb')).sort()) inspect(resolve(modelsDir, f), false);
} else {
  for (const f of args) inspect(resolve(root, f), true);
}
