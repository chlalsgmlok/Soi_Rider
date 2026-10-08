import type { CamPose } from '../../../camera';
import { forwardOf, rightOf } from '../../../core/math2d';
import type { Sightlines } from '../shared/sightlines';
import type { StandSite } from './stand-site';

/** art direction of the intro shots (metres in the rider's frame: back / right / up) */
export const INTRO_SHOT = {
  stand: {
    back: 6.4, right: 3.4, up: 3.5, fov: 38, subjectY: 0.95, ndcY: 0.06,
    /** starts this much further out and settles in over `settleTime` s */
    settle: 1.6, settleTime: 9,
    tilt: 0.55, band: 0.2, feather: 0.32, parallaxYaw: 0.035, parallaxUp: 0.25,
  },
  high: { back: 22, right: 9, up: 21, ahead: 9, fov: 40, tilt: 1, band: 0.15, feather: 0.3 },
} as const;

export interface ShotOffset {
  back: number;
  right: number;
  up: number;
}

/** stand-shot nudges tried in order when a canopy or awning hides the stand: authored, craned, tucked under, pulled out */
const STAND_TRIES: readonly ShotOffset[] = [
  { back: 0, right: 0, up: 0 }, { back: 0, right: 0, up: 1.8 }, { back: -1.6, right: -0.8, up: -1 }, { back: 2, right: 0.6, up: 3 },
];
/** establishing positions tried in order (a tower or tree may stand where the authored one is) */
const HIGH_TRIES: readonly ShotOffset[] = [
  { back: 22, right: 9, up: 21 }, { back: 22, right: -9, up: 21 }, { back: 15, right: 0, up: 28 }, { back: 8, right: 0, up: 46 },
];

/** world point `o` metres around the spawn (rider frame) */
function around(site: StandSite, o: ShotOffset, ground: number): { x: number; y: number; z: number } {
  const s = site.spawn;
  const f = forwardOf(s.heading);
  const r = rightOf(s.heading);
  return { x: s.pos.x - f.x * o.back + r.x * o.right, y: ground + o.up, z: s.pos.z - f.z * o.back + r.z * o.right };
}

/** the stand-shot offset (on top of INTRO_SHOT.stand) from which the rider and the stand are in plain view */
export function standOffset(lines: Sightlines, site: StandSite, ground: number): ShotOffset {
  const S = INTRO_SHOT.stand;
  for (const t of STAND_TRIES) {
    const eye = around(site, { back: S.back + t.back, right: S.right + t.right, up: S.up + t.up }, ground);
    if (lines.clear(eye, site.spawn.pos, 1) && lines.clear(eye, site.focus, S.subjectY)) return t;
  }
  return STAND_TRIES[0];
}

/** the establishing high shot: looking down the soi past the rider toward its mouth, over every roof and tree */
export function highPose(lines: Sightlines, site: StandSite, ground: number, out: CamPose): CamPose {
  const H = INTRO_SHOT.high;
  const pick = HIGH_TRIES.find((o) => lines.clear(around(site, o, ground), site.spawn.pos, 1)) ?? HIGH_TRIES[HIGH_TRIES.length - 1];
  const eye = around(site, pick, ground);
  const ahead = around(site, { back: -H.ahead, right: 0, up: 0 }, ground);
  out.pos.set(eye.x, eye.y, eye.z);
  out.target.set(ahead.x, ahead.y, ahead.z);
  Object.assign(out, { fov: H.fov, roll: 0, tilt: H.tilt, band: H.band, feather: H.feather });
  return out;
}
