import { type PerspectiveCamera, Vector3 } from 'three';
import { applyPose, type CameraPost, newPose, screenY } from '../../../camera';
import { TAU } from '../../../core/math2d';
import { aimAt, freeNdcX } from '../shared/aim';

/** the garage UI panel docks right: 460 px + 2 × 20 px gaps at the 1280×720 design size */
const PANEL_PX = 500;

/** art direction of the garage camera */
export const GARAGE_SHOT = {
  /** camera distance from the stage centre (m), height above the disc, swing to the right of the shop axis (rad) */
  dist: 7.8,
  height: 1.45,
  side: 0.2,
  fov: 30,
  /** the framed subject point above the disc (bike + rider centre) */
  subjectY: 0.92,
  /** subject sits this far above the screen centre (NDC) — the bike name caption owns the bottom-left */
  ndcY: 0.15,
  /** slow dolly breathing (fraction, period s) and mouse parallax (rad, m) */
  breathe: 0.025,
  breathePeriod: 9,
  parallaxYaw: 0.06,
  parallaxUp: 0.18,
  /** soft lens: light tilt-shift with a wide band on the bike */
  tilt: 0.42,
  band: 0.2,
  feather: 0.34,
} as const;

/**
 * The garage's locked-off showroom camera: in front of the shop, aimed so the bike + rider sit centred in the space
 * left of the right-docked panel (whatever the viewport), breathing a little and nudged by the mouse.
 */
export class GarageCamera {
  private readonly pose = newPose();
  private readonly subject = new Vector3();
  private readonly post: CameraPost = { tiltShift: GARAGE_SHOT.tilt, focusY: 0.5, focusBand: GARAGE_SHOT.band, focusFeather: GARAGE_SHOT.feather };
  private t = 0;

  update(dt: number, camera: PerspectiveCamera, stage: Vector3, parallax: { x: number; y: number }, reduced: boolean): CameraPost {
    if (!reduced) this.t += dt;
    const S = GARAGE_SHOT;
    const dist = S.dist * (1 + Math.sin((this.t / S.breathePeriod) * TAU) * S.breathe);
    const yaw = S.side + parallax.x * S.parallaxYaw;
    const eye = this.pose.pos.set(
      stage.x + Math.sin(yaw) * dist, stage.y + S.height + parallax.y * S.parallaxUp, stage.z + Math.cos(yaw) * dist,
    );
    this.subject.set(stage.x, stage.y + S.subjectY, stage.z);
    aimAt(eye, this.subject, freeNdcX(innerWidth, innerHeight, PANEL_PX), S.ndcY, S.fov, camera.aspect, dist, this.pose.target);
    this.pose.fov = S.fov;
    this.pose.roll = 0;
    applyPose(camera, this.pose);
    this.post.focusY = screenY(camera, this.subject);
    return this.post;
  }
}
