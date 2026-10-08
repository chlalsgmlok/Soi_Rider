import { CanvasTexture, SRGBColorSpace } from 'three';

let glow: CanvasTexture | null = null;
let beam: CanvasTexture | null = null;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('[glow] 2D canvas unavailable');
  return [c, g];
}

/** soft radial lamp glow (shared, lives for the app) */
export function glowTexture(): CanvasTexture {
  if (glow) return glow;
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,244,214,0.85)');
  grad.addColorStop(0.5, 'rgba(255,214,150,0.22)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glow = new CanvasTexture(c);
  glow.colorSpace = SRGBColorSpace;
  return glow;
}

/**
 * Headlight pool on the asphalt: a cone that is brightest a few metres ahead and fades out at the far end and
 * the edges. Texture v = 0 at the lamp, 1 at the far end (shared).
 */
export function beamTexture(): CanvasTexture {
  if (beam) return beam;
  const W = 64;
  const H = 128;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const along = Math.min(1, v / 0.18) * Math.pow(1 - v, 1.6);
    const halfW = 0.18 + 0.82 * v;
    for (let x = 0; x < W; x++) {
      const u = Math.abs((x / (W - 1)) * 2 - 1) / halfW;
      const across = u >= 1 ? 0 : Math.pow(1 - u * u, 1.5);
      const a = Math.min(1, along * across * 1.6);
      const i = (y * W + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 236;
      img.data[i + 2] = 196;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  beam = new CanvasTexture(c);
  beam.colorSpace = SRGBColorSpace;
  return beam;
}
