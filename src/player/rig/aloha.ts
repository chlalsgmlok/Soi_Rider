import { BufferAttribute, type BufferGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { Rng } from '../../core/rng';

const SIZE = 256;

/** hibiscus: five round petals around a yellow eye, drawn wrapped so the tile repeats seamlessly */
function flower(g: CanvasRenderingContext2D, x: number, z: number, r: number, rot: number, petal: string): void {
  for (const ox of [-SIZE, 0, SIZE]) {
    for (const oz of [-SIZE, 0, SIZE]) {
      g.save();
      g.translate(x + ox, z + oz);
      g.rotate(rot);
      g.fillStyle = petal;
      for (let i = 0; i < 5; i++) {
        g.rotate((Math.PI * 2) / 5);
        g.beginPath();
        g.ellipse(0, -r * 0.55, r * 0.42, r * 0.58, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffd54a';
      g.beginPath();
      g.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
}

function leaf(g: CanvasRenderingContext2D, x: number, z: number, r: number, rot: number, color: string): void {
  for (const ox of [-SIZE, 0, SIZE]) {
    for (const oz of [-SIZE, 0, SIZE]) {
      g.save();
      g.translate(x + ox, z + oz);
      g.rotate(rot);
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(0, 0, r * 0.32, r, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
}

/**
 * Procedural "flower shirt" tile on the outfit colour: dark leaves under cream/coral hibiscus.
 * Deterministic for a given base colour. Caller owns (and disposes) the texture.
 */
export function alohaTexture(base: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  if (!g) throw new Error('[aloha] 2D canvas unavailable');
  g.fillStyle = base;
  g.fillRect(0, 0, SIZE, SIZE);
  const rng = new Rng(0xa10a);
  for (let i = 0; i < 9; i++) leaf(g, rng.range(0, SIZE), rng.range(0, SIZE), rng.range(20, 30), rng.range(0, Math.PI), 'rgba(20,70,40,0.55)');
  const petals = ['#fff6e8', '#ff8f7a', '#fff6e8', '#ffd0a8'];
  for (let i = 0; i < 7; i++) flower(g, rng.range(0, SIZE), rng.range(0, SIZE), rng.range(20, 30), rng.range(0, Math.PI), petals[i % petals.length]);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Cylindrical UVs around the body's vertical axis (char_body has no UVs): u wraps around, v follows height.
 * `scale` = texture repeats per metre of height. Returns a NEW geometry (the template's stays shared and untouched).
 */
export function cylinderUv(geo: BufferGeometry, scale = 4): BufferGeometry {
  const out = geo.clone();
  const pos = out.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (Math.atan2(pos.getX(i), pos.getZ(i)) / (Math.PI * 2) + 0.5) * 3;
    uv[i * 2 + 1] = pos.getY(i) * scale;
  }
  out.setAttribute('uv', new BufferAttribute(uv, 2));
  return out;
}
