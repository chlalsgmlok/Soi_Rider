import { type PerspectiveCamera, Vector3 } from 'three';
import { applyPose, type CameraPost, type CameraRig, type CamPose, newPose, screenY } from '../../../camera';
import { forwardOf, rightOf } from '../../../core/math2d';
import type { PlayerState } from '../../../core/types';
import { aimAt, freeNdcX } from '../shared/aim';
import type { Sightlines } from '../shared/sightlines';
import { highPose, INTRO_SHOT, type ShotOffset, standOffset } from './intro-shots';
import type { StandSite } from './stand-site';
import { arcAway, swoopPose } from './swoop-path';

/** the gram phone docks right: 360 px phone + 9vw margin + gap, at the 1280×720 design size */
const PHONE_PX = 500;

const fwdV = new Vector3();

/**
 * The intro camera: a warm stand shot (rider, win stand and Lek's cart in the space left of the gram phone, slowly
 * settling in), then on accept the swoop — crane up to an establishing high shot, swoop down and land exactly on the
 * ride camera's own framing (the CameraRig is updated throughout, so PLAY continues without a cut).
 */
export class IntroCamera {
  private phase: 'stand' | 'swoop' | 'ride' = 'stand';
  private t = 0;
  private u = 0;
  private dur = 3.4;
  /** the descent's sideways arc, fixed on the first swoop frame so it can never flip mid-flight */
  private arc: number | null = null;
  private resolve: (() => void) | null = null;
  private readonly stand = newPose();
  private readonly high = newPose();
  private readonly ride = newPose();
  private readonly out = newPose();
  private readonly subject = new Vector3();
  private readonly rider = new Vector3();
  private readonly post: CameraPost = { tiltShift: 0.5, focusY: 0.5, focusBand: 0.2, focusFeather: 0.3 };
  /** stand-shot nudge that keeps the stand in plain view */
  private readonly nudge: ShotOffset;

  /** `lines` = sight lines over the run's city (picks shot positions no tree, awning or tower blocks) */
  constructor(private readonly site: StandSite, private readonly rig: CameraRig, private readonly ground: number, lines: Sightlines) {
    const s = site.spawn;
    this.rider.set(s.pos.x, ground + 0.9, s.pos.z);
    this.subject.set(site.focus.x, ground + INTRO_SHOT.stand.subjectY, site.focus.z);
    this.nudge = standOffset(lines, site, ground);
    highPose(lines, site, ground, this.high);
  }

  get swooping(): boolean {
    return this.phase === 'swoop';
  }

  /** start the swoop; resolves when the camera sits on the ride framing (instantly with `cut`) */
  swoop(seconds: number, cut: boolean): Promise<void> {
    if (this.phase !== 'stand') return Promise.resolve();
    this.rig.snap();
    if (cut || seconds <= 0) {
      this.phase = 'ride';
      return Promise.resolve();
    }
    this.phase = 'swoop';
    this.u = 0;
    this.arc = null;
    this.dur = seconds;
    return new Promise((res) => (this.resolve = res));
  }

  update(dt: number, camera: PerspectiveCamera, state: PlayerState, parallax: { x: number; y: number }): CameraPost {
    if (this.phase === 'ride') return this.rig.update(dt, state, null);
    if (this.phase === 'stand') {
      this.t += dt;
      this.standPose(camera.aspect, parallax);
      return this.place(camera, this.stand);
    }
    this.u = Math.min(1, this.u + dt / this.dur);
    const rp = this.rig.update(dt, state, null);
    const r = this.ride;
    r.pos.copy(camera.position);
    r.target.copy(camera.position).addScaledVector(camera.getWorldDirection(fwdV), 12);
    Object.assign(r, { fov: camera.fov, roll: 0, tilt: rp.tiltShift, band: rp.focusBand, feather: rp.focusFeather });
    this.arc ??= arcAway(this.high, r, this.site.spawn.pos);
    swoopPose(this.stand, this.high, r, this.u, this.out, this.arc);
    const post = this.place(camera, this.out);
    if (this.u >= 1) {
      this.phase = 'ride';
      this.resolve?.();
      this.resolve = null;
    }
    return post;
  }

  private standPose(aspect: number, parallax: { x: number; y: number }): void {
    const S = INTRO_SHOT.stand;
    const s = this.site.spawn;
    const settle = S.settle * Math.exp(-this.t / (S.settleTime / 3));
    const h = s.heading + parallax.x * S.parallaxYaw;
    const f = forwardOf(h);
    const r = rightOf(h);
    const n = this.nudge;
    const back = S.back + n.back + settle;
    const right = S.right + n.right;
    const p = this.stand;
    p.pos.set(
      s.pos.x - f.x * back + r.x * right, this.ground + S.up + n.up + settle * 0.35 + parallax.y * S.parallaxUp,
      s.pos.z - f.z * back + r.z * right,
    );
    aimAt(p.pos, this.subject, freeNdcX(innerWidth, innerHeight, PHONE_PX), S.ndcY, S.fov, aspect, back, p.target);
    Object.assign(p, { fov: S.fov, roll: 0, tilt: S.tilt, band: S.band, feather: S.feather });
  }

  private place(camera: PerspectiveCamera, p: CamPose): CameraPost {
    applyPose(camera, p);
    const post = this.post;
    post.tiltShift = p.tilt;
    post.focusBand = p.band;
    post.focusFeather = p.feather;
    post.focusY = screenY(camera, this.rider) + p.band * 0.35;
    return post;
  }
}
