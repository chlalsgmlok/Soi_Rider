import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { PALETTE } from '../../../core/config/palette';
import {
  type ArrowKind, arrowPainter, blotchPainter, gratePainter, manholePainter, motoPainter, type Painter, textPainter,
} from './glyph-painters';

export type MarkKey =
  | 'white' | 'yellow' | 'boxfill' | 'manhole' | 'grate' | 'patch0' | 'patch1' | 'patch2' | 'oil'
  | `arrow_${ArrowKind}` | 'stop' | 'slow' | 'bus' | 'moto';

/** [u0, v0, u1, v1] — (u0, v0) = bottom-left of the glyph as it lies on the road */
export type UvRect = readonly [number, number, number, number];

const SIZE = 1024;
const PAD = 6;

const solid = (color: string): Painter => (g, w, h) => {
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
};

const ENTRIES: ReadonlyArray<[MarkKey, number, number, Painter, number]> = [
  ['white', 64, 64, solid('#f6f3ea'), 0.05],
  ['yellow', 64, 64, solid(PALETTE.laneYellow), 0.05],
  ['boxfill', 64, 64, solid('#3c9a5f'), 0.07],
  ['manhole', 128, 128, manholePainter, 0],
  ['grate', 128, 64, gratePainter, 0],
  ['patch0', 160, 128, blotchPainter('#3d3936', 0.28, 11), 0],
  ['patch1', 160, 128, blotchPainter('#8a8178', 0.16, 23), 0],
  ['patch2', 160, 128, blotchPainter('#35322f', 0.26, 37), 0],
  ['oil', 128, 128, blotchPainter('#1f1d1c', 0.18, 51), 0],
  ['arrow_S', 128, 288, arrowPainter('S'), 0.04],
  ['arrow_L', 128, 288, arrowPainter('L'), 0.04],
  ['arrow_R', 128, 288, arrowPainter('R'), 0.04],
  ['arrow_SL', 128, 288, arrowPainter('SL'), 0.04],
  ['arrow_SR', 128, 288, arrowPainter('SR'), 0.04],
  ['arrow_LR', 128, 288, arrowPainter('LR'), 0.04],
  ['arrow_U', 128, 288, arrowPainter('U'), 0.04],
  ['stop', 256, 128, textPainter('หยุด'), 0.05],
  ['slow', 256, 128, textPainter('ช้าลง'), 0.05],
  ['bus', 256, 128, textPainter('รถเมล์'), 0.05],
  ['moto', 128, 128, motoPainter, 0.03],
];

/** chipped paint: punch tiny holes into the glyph so markings read worn */
function wear(g: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number): void {
  if (amount <= 0) return;
  let s = seed;
  const rnd = (): number => ((s = (s * 48271) % 2147483647) / 2147483647);
  g.globalCompositeOperation = 'destination-out';
  const n = Math.round(w * h * amount * 0.02);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.4 + rnd() * 0.6;
    g.beginPath();
    g.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/** Static road-marking atlas: paints, glyphs, Thai road words, covers and stains. */
export class MarkingsAtlas {
  readonly texture: CanvasTexture;
  private readonly rects = new Map<MarkKey, UvRect>();

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    let x = PAD;
    let y = PAD;
    let rowH = 0;
    ENTRIES.forEach(([key, w, h, paint, amount], i) => {
      if (x + w + PAD > SIZE) {
        x = PAD;
        y += rowH + PAD * 2;
        rowH = 0;
      }
      g.save();
      g.translate(x, y);
      g.beginPath();
      g.rect(0, 0, w, h);
      g.clip();
      paint(g, w, h);
      wear(g, w, h, amount, 1000 + i * 77);
      g.restore();
      const inset = key === 'white' || key === 'yellow' || key === 'boxfill' ? 8 : 1;
      this.rects.set(key, [(x + inset) / SIZE, 1 - (y + h - inset) / SIZE, (x + w - inset) / SIZE, 1 - (y + inset) / SIZE]);
      x += w + PAD * 2;
      rowH = Math.max(rowH, h);
    });
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.name = 'road_markings_atlas';
  }

  rect(key: MarkKey): UvRect {
    const r = this.rects.get(key);
    if (!r) throw new Error(`[markings] no atlas cell "${key}"`);
    return r;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
