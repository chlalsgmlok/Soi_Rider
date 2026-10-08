/**
 * Canvas painters for road-marking glyphs (white on transparent unless stated). Each draws inside a w × h cell whose
 * top edge is "ahead" of the driver once laid on the road.
 */
export type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export type ArrowKind = 'S' | 'L' | 'R' | 'SL' | 'SR' | 'LR' | 'U';

const SHAFT = 0.16;

function head(g: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.beginPath();
  g.moveTo(0, -size);
  g.lineTo(size * 0.62, size * 0.15);
  g.lineTo(-size * 0.62, size * 0.15);
  g.closePath();
  g.fill();
  g.restore();
}

/** turn arrows: S straight, L/R turn, combos and U-turn; drawn in a tall cell (shaft from the bottom centre) */
export function arrowPainter(kind: ArrowKind): Painter {
  return (g, w, h) => {
    const cx = w / 2;
    const sw = w * SHAFT;
    const hs = w * 0.3;
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffffff';
    g.lineWidth = sw;
    g.lineCap = 'butt';
    const base = h * 0.98;
    const split = h * 0.55;
    g.fillRect(cx - sw / 2, split, sw, base - split);
    const straight = kind.includes('S');
    if (straight) {
      g.fillRect(cx - sw / 2, h * 0.24, sw, split - h * 0.24 + 1);
      head(g, cx, h * 0.04, 0, hs);
    }
    for (const side of [-1, 1] as const) {
      const want = side < 0 ? kind.includes('L') : kind.includes('R');
      if (!want) continue;
      g.beginPath();
      g.moveTo(cx, split + 2);
      g.quadraticCurveTo(cx, h * 0.36, cx + side * w * 0.26, h * 0.32);
      g.stroke();
      head(g, cx + side * w * 0.3, h * 0.32, (side * Math.PI) / 2, hs * 0.85);
    }
    if (kind === 'U') {
      g.beginPath();
      g.moveTo(cx + w * 0.16, split + 2);
      g.lineTo(cx + w * 0.16, h * 0.3);
      g.arc(cx - w * 0.04, h * 0.3, w * 0.2, 0, Math.PI, true);
      g.lineTo(cx - w * 0.24, h * 0.45);
      g.stroke();
      head(g, cx - w * 0.24, h * 0.52, Math.PI, hs * 0.8);
    }
  };
}

/** elongated road text (it is stretched ~3× along the lane when laid down) */
export function textPainter(text: string, weight = 800): Painter {
  return (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = h * 0.9;
    g.font = `${weight} ${size}px Kanit, "Leelawadee UI", Tahoma, sans-serif`;
    const m = g.measureText(text).width;
    if (m > w * 0.94) size *= (w * 0.94) / m;
    g.font = `${weight} ${size}px Kanit, "Leelawadee UI", Tahoma, sans-serif`;
    g.fillText(text, w / 2, h * 0.55);
  };
}

/** motorbike (scooter) pictogram for the bike waiting box — side view, filled body */
export const motoPainter: Painter = (g, w, h) => {
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  g.lineWidth = w * 0.06;
  for (const x of [w * 0.22, w * 0.78]) {
    g.beginPath();
    g.arc(x, h * 0.72, w * 0.13, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(w * 0.12, h * 0.6);
  g.lineTo(w * 0.36, h * 0.48);
  g.lineTo(w * 0.6, h * 0.5);
  g.lineTo(w * 0.66, h * 0.66);
  g.lineTo(w * 0.36, h * 0.68);
  g.closePath();
  g.fill();
  g.fillRect(w * 0.3, h * 0.42, w * 0.22, h * 0.08);
  g.beginPath();
  g.moveTo(w * 0.62, h * 0.5);
  g.lineTo(w * 0.74, h * 0.26);
  g.lineTo(w * 0.86, h * 0.24);
  g.stroke();
  g.beginPath();
  g.moveTo(w * 0.74, h * 0.28);
  g.lineTo(w * 0.8, h * 0.62);
  g.stroke();
};

/** cast-iron manhole cover (opaque, dark) */
export const manholePainter: Painter = (g, w, h) => {
  const r = Math.min(w, h) * 0.48;
  g.fillStyle = '#5d5a55';
  g.beginPath();
  g.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#7d7870';
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.arc(w / 2, h / 2, r * 0.82, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = r * 0.07;
  for (let k = -3; k <= 3; k++) {
    g.beginPath();
    const y = h / 2 + k * r * 0.2;
    const half = Math.sqrt(Math.max(0, (r * 0.7) ** 2 - (k * r * 0.2) ** 2));
    g.moveTo(w / 2 - half, y);
    g.lineTo(w / 2 + half, y);
    g.stroke();
  }
};

/** storm drain grate (opaque, dark slots in a steel frame) */
export const gratePainter: Painter = (g, w, h) => {
  g.fillStyle = '#6b6862';
  g.fillRect(w * 0.04, h * 0.08, w * 0.92, h * 0.84);
  g.fillStyle = '#2a2826';
  for (let k = 0; k < 7; k++) g.fillRect(w * (0.1 + k * 0.12), h * 0.2, w * 0.06, h * 0.6);
};

/** soft dark blotch (asphalt repair patch / oil stain); `alpha` = peak opacity */
export function blotchPainter(color: string, alpha: number, seed: number): Painter {
  return (g, w, h) => {
    let s = seed;
    const rnd = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.fillStyle = color;
    g.globalAlpha = alpha;
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      g.ellipse(w * (0.3 + rnd() * 0.4), h * (0.3 + rnd() * 0.4), w * (0.16 + rnd() * 0.18), h * (0.16 + rnd() * 0.18), rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };
}
