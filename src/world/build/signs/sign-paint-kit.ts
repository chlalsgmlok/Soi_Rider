/** Canvas helpers shared by the sign designs. */
export type SignPainter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export const THAI_FONT = 'Kanit, "Leelawadee UI", Tahoma, sans-serif';
export const KOREAN_FONT = '"Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif';
export const CJK_FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", serif';

const HANGUL = /[가-힯]/;
const CJK = /[一-鿿]/;

/** font stack for a string (Hangul → Pretendard, Han → CJK, else Kanit) */
export function fontFor(text: string): string {
  if (HANGUL.test(text)) return KOREAN_FONT;
  if (CJK.test(text)) return CJK_FONT;
  return THAI_FONT;
}

/** draw text centred at (x, y), shrunk to fit maxW */
export function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight = 700): void {
  const family = fontFor(text);
  g.font = `${weight} ${size}px ${family}`;
  const m = g.measureText(text).width;
  if (m > maxW) g.font = `${weight} ${Math.max(6, (size * maxW) / m)}px ${family}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** relative luminance of a #rrggbb colour (sRGB, rough) */
export function luma(hex: string): number {
  const v = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(v)) return 0.5;
  return (((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114) / 255;
}

/** dark or light ink that reads on a board colour */
export const inkOn = (board: string): string => (luma(board) > 0.62 ? '#1d1a24' : '#fffaf0');
