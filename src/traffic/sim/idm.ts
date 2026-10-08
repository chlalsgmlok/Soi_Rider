/**
 * Intelligent Driver Model (Treiber et al.). Pure functions; the simulation clamps the result between the
 * emergency deceleration and the driver's comfortable acceleration.
 */
export interface IdmParams {
  /** max acceleration (m/s²) */
  a: number;
  /** comfortable deceleration (m/s², positive) */
  b: number;
  /** desired time headway (s) */
  T: number;
  /** jam distance bumper-to-bumper (m) */
  s0: number;
}

/** hardest braking any NPC will apply (m/s², negative) */
export const EMERGENCY_DECEL = -9;

/** free-road term: 1 − (v/v0)^4 */
export function freeRoad(v: number, v0: number): number {
  const r = v / Math.max(0.1, v0);
  return 1 - r * r * r * r;
}

/**
 * IDM acceleration for speed v, desired speed v0, bumper gap `gap` (m) to a leader closing at dv = v − vLeader.
 * gap = Infinity → free road.
 */
export function idmAccel(v: number, v0: number, gap: number, dv: number, p: IdmParams): number {
  const free = freeRoad(v, v0);
  if (!Number.isFinite(gap)) return p.a * free;
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)));
  const g = Math.max(gap, 0.05);
  return Math.max(EMERGENCY_DECEL, p.a * (free - (sStar / g) * (sStar / g)));
}

/**
 * Braking to stand still with the front `dist` metres further on (stop line, junction gate). Uses the IDM with a
 * standing virtual leader but a reduced jam distance so vehicles creep right up to the line.
 */
export function stopAccel(v: number, v0: number, dist: number, p: IdmParams): number {
  const s0 = Math.min(p.s0, 0.4);
  return idmAccel(v, v0, dist + p.s0 - s0, v, p);
}

/** deceleration needed to bring v to vTarget within d metres (≤ 0 when already slow enough) */
export function approachAccel(v: number, vTarget: number, d: number): number {
  if (v <= vTarget) return Infinity;
  return (vTarget * vTarget - v * v) / (2 * Math.max(0.5, d));
}
