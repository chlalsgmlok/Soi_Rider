import { bump, track } from '../../../player/rig/keyframes';

/** length of the equip hop (s) */
export const EQUIP_TIME = 0.62;
/** peak hop height (m) */
export const EQUIP_HOP = 0.17;

/** offsets for the bike + rider group: lift (m) and a volume-preserving squash (y scale, x/z scale) */
export interface EquipPose {
  lift: number;
  sy: number;
  sxz: number;
}

/** squash under the new part's weight → springy hop → land → wobble to rest */
const SQUASH: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0.07, 0.9], [0.13, 1.06], [0.3, 1], [0.38, 0.93], [0.47, 1.025], [0.55, 0.995], [EQUIP_TIME, 1],
];

/** the equip animation at `t` seconds after the change (outside 0..EQUIP_TIME = rest) */
export function equipPose(t: number, out: EquipPose = { lift: 0, sy: 1, sxz: 1 }): EquipPose {
  if (!(t >= 0 && t < EQUIP_TIME)) {
    out.lift = 0;
    out.sy = 1;
    out.sxz = 1;
    return out;
  }
  out.lift = EQUIP_HOP * bump(t, 0.07, 0.37);
  out.sy = track(SQUASH, t);
  out.sxz = 1 / Math.sqrt(out.sy);
  return out;
}

/** plays `equipPose` from `start()`; idle = rest pose */
export class EquipBounce {
  readonly pose: EquipPose = { lift: 0, sy: 1, sxz: 1 };
  private t = Infinity;

  start(): void {
    this.t = 0;
  }

  update(dt: number): EquipPose {
    this.t += dt;
    return equipPose(this.t, this.pose);
  }
}
