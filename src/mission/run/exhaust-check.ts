import type { TrafficAgentView, TrafficQuery, VehicleKind, Vec2 } from '../../core/types';

/** smoky vehicles: diesel buses / songthaews and two-stroke tuk-tuks (docs/GAME_DESIGN.md §7 haze) */
const SMOKY: ReadonlySet<VehicleKind> = new Set<VehicleKind>(['bus', 'songthaew', 'tuktuk']);
/** "right behind": the tailpipe within this many metres ahead of the rider */
export const EXHAUST_REACH = 9;

/** true when the rider sits in the exhaust plume of a bus / songthaew / tuk-tuk driving ahead the same way */
export function behindExhaust(pos: Vec2, heading: number, traffic: TrafficQuery, scratch: TrafficAgentView[]): boolean {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const n = traffic.near(pos, EXHAUST_REACH + 7, scratch);
  for (let i = 0; i < n; i++) {
    const a = scratch[i];
    if (!SMOKY.has(a.kind) || Math.cos(a.heading - heading) < 0.7) continue;
    const dx = a.pos.x - pos.x;
    const dz = a.pos.z - pos.z;
    const tail = dx * fx + dz * fz - a.spec.length / 2;
    const side = Math.abs(dx * fz - dz * fx);
    if (tail > -0.5 && tail < EXHAUST_REACH && side < a.spec.width / 2 + 0.9) return true;
  }
  return false;
}
