import type { OBB } from '../core/types';
import { MIRROR_HALF_H, RIDER_TOP, type SensedRider } from './collision-types';

/** top of the bike band: bars, knees, bags (m) */
export const BIKE_TOP = 1.1;
/** the rider's shoulders/helmet above the bars: narrower than the bars, centred over the seat */
const TORSO_HW = 0.25;
const TORSO_HW_TUCK = 0.21;
const TORSO_HL = 0.32;
const TORSO_BACK = 0.12;

/** One solid piece of the rider at a height band. `slot` is stable per piece (contact bookkeeping). */
export interface RiderPiece {
  obb: OBB;
  y0: number;
  y1: number;
  slot: number;
  role: 'body' | 'mirror';
}

/**
 * The rider as height bands: bike hull (0 – 1.1 m, full bar width), torso (1.1 – 1.75 m, shoulder width over the
 * seat; crouched lower and narrower when tucked) and the two mirror heads at `mirrorY`. A high van mirror can
 * pass the bars and only meet the shoulders; a sedan's low flank never reaches the mirrors' band above its belt.
 */
export class RiderPieces {
  readonly list: RiderPiece[];
  private readonly torso: OBB = { cx: 0, cz: 0, hw: TORSO_HW, hl: TORSO_HL, angle: 0 };

  constructor() {
    const blank = (): OBB => ({ cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 });
    this.list = [
      { obb: blank(), y0: 0, y1: BIKE_TOP, slot: 0, role: 'body' },
      { obb: this.torso, y0: BIKE_TOP, y1: RIDER_TOP, slot: 1, role: 'body' },
      { obb: blank(), y0: 0, y1: 0, slot: 2, role: 'mirror' },
      { obb: blank(), y0: 0, y1: 0, slot: 3, role: 'mirror' },
    ];
  }

  /** refresh from the rider state; returns how many pieces are live (a fallen bike is one low slab) */
  update(r: SensedRider): number {
    const s = r.state;
    const [hull, torso, ml, mr] = this.list;
    hull.obb = s.obb;
    hull.y1 = s.fallen ? 0.9 : BIKE_TOP;
    if (s.fallen) return 1;
    const t = this.torso;
    t.angle = s.heading;
    t.hw = s.tuck ? TORSO_HW_TUCK : TORSO_HW;
    t.cx = s.pos.x - Math.sin(s.heading) * TORSO_BACK;
    t.cz = s.pos.z - Math.cos(s.heading) * TORSO_BACK;
    torso.y0 = s.tuck ? 0.98 : BIKE_TOP;
    torso.y1 = s.tuck ? 1.5 : RIDER_TOP;
    const my = r.stats.mirrorY;
    ml.obb = s.mirrors[0];
    mr.obb = s.mirrors[1];
    ml.y0 = mr.y0 = my - MIRROR_HALF_H;
    ml.y1 = mr.y1 = my + MIRROR_HALF_H;
    return 4;
  }
}
