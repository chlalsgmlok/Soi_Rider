/**
 * `v` when it is a finite number, otherwise `fallback`. Guards the receipt and the wallet: one NaN from a physics glitch
 * upstream must never turn into "NaN ฿" or a NaN-star review.
 */
export const finiteOr = (v: number, fallback = 0): number => (Number.isFinite(v) ? v : fallback);
