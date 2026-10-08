/** HUD number formatting (pure, unit-tested in format.test.ts). */

/** 7 → "7", 342 → "340", 995 → "1.0" km (never "1000 m"), 1260 → "1.3" + unit "km" */
export function fmtDistance(m: number): { num: string; unit: 'm' | 'km' } {
  const v = Math.max(0, m);
  const tens = Math.round(v / 10) * 10;
  if (tens >= 1000) return { num: (v / 1000).toFixed(v >= 9950 ? 0 : 1), unit: 'km' };
  if (v >= 100) return { num: String(tens), unit: 'm' };
  return { num: String(Math.round(v)), unit: 'm' };
}

/** seconds → "03:12"; negative values are formatted by absolute value */
export function fmtClock(sec: number): string {
  const s = Math.floor(Math.abs(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** ETA chip state: ≥ 30 s normal, 0–30 s warn, < 0 late */
export function etaState(sec: number): 'ok' | 'warn' | 'late' {
  return sec < 0 ? 'late' : sec < 30 ? 'warn' : 'ok';
}

/** clearance colour band: ≥ 30 cm cyan, 10–30 amber, < 10 coral */
export function gapBand(cm: number): 'ok' | 'tight' | 'critical' {
  return cm >= 30 ? 'ok' : cm >= 10 ? 'tight' : 'critical';
}

/** splits "NEAR MISS ×3 +120" into label + points (points may be absent) */
export function splitPopup(text: string): { label: string; pts: string } {
  const m = text.match(/^(.*?)\s*([+−-]\s?\d[\d,]*)$/);
  return m && m[1] ? { label: m[1], pts: m[2].replace(/\s/g, '') } : { label: text, pts: '' };
}

/** speed display with hysteresis so 14.5 km/h does not flicker between 14 and 15 */
export function stableSpeed(raw: number, shown: number): number {
  const v = Math.abs(raw);
  return Math.abs(v - shown) >= 0.6 ? Math.round(v) : shown;
}
