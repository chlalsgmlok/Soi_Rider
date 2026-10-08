import type { OBB, VehicleSpec } from '../../core/types';

/** mirror head hit box of an NPC vehicle: lateral × longitudinal (m) */
export const NPC_MIRROR_W = 0.16;
export const NPC_MIRROR_L = 0.1;

/**
 * Body + mirror boxes of a vehicle at a pose, from its VehicleSpec (the same contract src/traffic follows):
 * body = width × length; mirrors = thin boxes whose outer edge is at ±mirrorSpan/2, `mirrorZ` ahead of centre.
 * Writes into `out` when given (pooled agents), else allocates.
 */
export function agentHull(
  spec: VehicleSpec, x: number, z: number, heading: number, out?: { obb: OBB; mirrors: OBB[] },
): { obb: OBB; mirrors: OBB[] } {
  const res = out ?? { obb: { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 }, mirrors: [] };
  const s = Math.sin(heading);
  const c = Math.cos(heading);
  Object.assign(res.obb, { cx: x, cz: z, hw: spec.width / 2, hl: spec.length / 2, angle: heading });
  if (spec.mirrorSpan <= 0) {
    res.mirrors.length = 0;
    return res;
  }
  const lat = spec.mirrorSpan / 2 - NPC_MIRROR_W / 2;
  for (let i = 0; i < 2; i++) {
    const r = i === 0 ? -lat : lat; // [left, right]
    const m = res.mirrors[i] ?? (res.mirrors[i] = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 });
    m.cx = x - c * r + s * spec.mirrorZ;
    m.cz = z + s * r + c * spec.mirrorZ;
    m.hw = NPC_MIRROR_W / 2;
    m.hl = NPC_MIRROR_L / 2;
    m.angle = heading;
  }
  res.mirrors.length = 2;
  return res;
}
