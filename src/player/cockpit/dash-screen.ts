import { CanvasTexture, SRGBColorSpace } from 'three';

const W = 256;
const H = 128;
const ON = '#dff8ff';
const OFF = 'rgba(120,170,185,0.045)';
const CYAN = '#3ee6d4';
/** the speed digits: three slots from DIGIT_X, DIGIT_STEP apart (the bezel hides the texture below ≈ y 96) */
const DIGIT_X = 44;
const DIGIT_STEP = 46;
const DIGIT_Y = 26;
const DIGIT_W = 36;
const DIGIT_H = 66;
/** "km/h" sits right of the digits on their baseline, big enough to read at 1280×720 */
const UNIT_X = 182;
const UNIT_FONT = '700 30px Kanit, "Arial Narrow", Arial, sans-serif';

/** seven-segment layout: a b c d e f g (top, top-right, bottom-right, bottom, bottom-left, top-left, middle) */
const DIGITS: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

function segment(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seg: string, t: number): void {
  const s = t * 0.5;
  const paths: Record<string, Array<[number, number]>> = {
    a: [[x + s, y], [x + w - s, y], [x + w - t, y + t], [x + t, y + t]],
    d: [[x + t, y + h - t], [x + w - t, y + h - t], [x + w - s, y + h], [x + s, y + h]],
    g: [[x + s, y + h / 2], [x + t, y + h / 2 - s], [x + w - t, y + h / 2 - s], [x + w - s, y + h / 2], [x + w - t, y + h / 2 + s], [x + t, y + h / 2 + s]],
    f: [[x, y + s], [x + t, y + t], [x + t, y + h / 2 - s], [x, y + h / 2 - s * 0.2]],
    e: [[x, y + h / 2 + s * 0.2], [x + t, y + h / 2 + s], [x + t, y + h - t], [x, y + h - s]],
    b: [[x + w, y + s], [x + w, y + h / 2 - s * 0.2], [x + w - t, y + h / 2 - s], [x + w - t, y + t]],
    c: [[x + w, y + h / 2 + s * 0.2], [x + w, y + h - s], [x + w - t, y + h - t], [x + w - t, y + h / 2 + s]],
  };
  const pts = paths[seg];
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
}

function digit(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ch: string | null): void {
  const lit = ch === null ? '' : DIGITS[ch] ?? '';
  for (const seg of 'abcdefg') {
    g.fillStyle = lit.includes(seg) ? ON : OFF;
    g.shadowBlur = lit.includes(seg) ? 10 : 0;
    segment(g, x, y, w, h, seg, 8);
  }
}

/**
 * The bike's LCD (Dash_Screen): big seven-segment speed digits with ghost segments, a "km/h" unit beside them, a
 * segmented tach arc and a gram-cyan trip mark — mockup 02. Redraws only when what it shows changes.
 */
export class DashScreen {
  readonly texture: CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private shown = '';

  constructor() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) throw new Error('[dash] 2D canvas unavailable');
    this.g = g;
    this.texture = new CanvasTexture(c);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.flipY = false; // glTF UV convention (blender/assets/bikes/README.md)
    this.texture.anisotropy = 4;
    this.draw(0, 0);
  }

  /** `rev` 0..1 = engine load for the tach bar */
  draw(speedKmh: number, rev: number): void {
    const v = Math.min(199, Math.max(0, Math.round(speedKmh)));
    const bars = Math.round(Math.min(1, Math.max(0, rev)) * 14);
    const key = `${v}|${bars}`;
    if (key === this.shown) return;
    this.shown = key;
    const g = this.g;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#16262d');
    bg.addColorStop(1, '#0a1215');
    g.shadowBlur = 0;
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.shadowColor = 'rgba(160,240,255,0.65)';
    const str = String(v).padStart(3, ' ');
    for (let i = 0; i < 3; i++) digit(g, DIGIT_X + i * DIGIT_STEP, DIGIT_Y, DIGIT_W, DIGIT_H, str[i] === ' ' ? null : str[i]);
    g.fillStyle = ON;
    g.font = UNIT_FONT;
    g.shadowBlur = 6;
    g.fillText('km/h', UNIT_X, DIGIT_Y + DIGIT_H);
    g.shadowBlur = 0;
    for (let i = 0; i < 14; i++) {
      g.fillStyle = i < bars ? (i >= 11 ? '#ff6b5e' : ON) : 'rgba(120,170,185,0.12)';
      g.fillRect(56 + i * 11, 12, 8, 8 + i * 0.4);
    }
    g.fillStyle = CYAN;
    g.beginPath();
    g.arc(26, 46, 9, Math.PI, 0);
    g.lineTo(26, 66);
    g.closePath();
    g.fill();
    g.fillStyle = '#0a1215';
    g.beginPath();
    g.arc(26, 46, 3.5, 0, Math.PI * 2);
    g.fill();
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
