import type { TurnKind, Vec2 } from '../../core/types';
import { angleDiff, headingOf } from '../../core/math2d';

/** sample a cubic Bézier into n points (first/last exactly p0/p3) */
function sampleCubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, n: number): Vec2[] {
  const pts: Vec2[] = [{ x: p0.x, z: p0.z }];
  for (let i = 1; i < n - 1; i++) {
    const t = i / (n - 1);
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    pts.push({ x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, z: a * p0.z + b * p1.z + c * p2.z + d * p3.z });
  }
  pts.push({ x: p3.x, z: p3.z });
  return pts;
}

/**
 * Connector path from a lane end (p0, travelling d0) to a lane start (p3, travelling d3). Turns use the
 * circular-arc control length (4/3)·tan(φ/4)/tan(φ/2) of the tangent-intersection distances; U-turns are a
 * hairpin whose apex reaches `reach` metres past p0 (≥ a semicircle across the lane separation).
 */
export function connectorPath(p0: Vec2, d0: Vec2, p3: Vec2, d3: Vec2, kind: TurnKind, reach = 0): Vec2[] {
  const chord = Math.hypot(p3.x - p0.x, p3.z - p0.z);
  let k0 = chord / 3;
  let k3 = chord / 3;
  if (kind === 'uturn') {
    const sep = Math.abs((p3.x - p0.x) * d0.z - (p3.z - p0.z) * d0.x);
    k0 = k3 = Math.max((4 / 3) * (sep / 2), reach / 0.75);
  } else if (kind !== 'straight') {
    const phi = Math.abs(angleDiff(headingOf(d0), headingOf(d3)));
    const den = d0.x * d3.z - d0.z * d3.x;
    const wx = p3.x - p0.x;
    const wz = p3.z - p0.z;
    const t = (wx * d3.z - wz * d3.x) / den;
    const s = (d0.x * wz - d0.z * wx) / den;
    if (Math.abs(den) > 1e-6 && t > 0.2 && s > 0.2) {
      const r = ((4 / 3) * Math.tan(phi / 4)) / Math.tan(phi / 2);
      k0 = t * r;
      k3 = s * r;
    } else {
      k0 = k3 = chord * 0.4;
    }
  }
  const p1 = { x: p0.x + d0.x * k0, z: p0.z + d0.z * k0 };
  const p2 = { x: p3.x - d3.x * k3, z: p3.z - d3.z * k3 };
  const approx = chord + (k0 + k3) * 0.5;
  const n = Math.max(8, Math.min(28, Math.ceil(approx / 1.0)));
  return sampleCubic(p0, p1, p2, p3, n);
}
