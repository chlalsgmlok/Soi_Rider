import { Vector3 } from 'three';
import { type CameraPost, type CameraRig, screenY } from '../../../camera';
import { TAU } from '../../../core/math2d';
import type { TitleSite } from './title-site';
import { shotTarget, shotYaw, type TitleShot } from './title-shot';

/**
 * The title's slow cinematic camera: `CameraRig.orbit` around the hero rider (who holds still on screen, right of
 * centre in the sharp band) sweeping back and forth across the approach — never round the back of the block — while
 * dollying in and out, nudged by the mouse. Reduced motion holds the framing still.
 */
export class TitleCamera {
  /** current orbit target (ground) */
  readonly target = new Vector3();
  private readonly heroPoint = new Vector3();
  private t = 0;

  private readonly shot: TitleShot;

  constructor(private readonly site: TitleSite) {
    this.shot = site.shot;
  }

  /** place the engine camera through the rig; returns the tilt-shift params for PostFx */
  update(dt: number, rig: CameraRig, parallax: { x: number; y: number }, reduced: boolean, ground: number, kerb: number): CameraPost {
    if (!reduced) this.t += dt;
    const S = this.shot;
    const phase = Math.sin((this.t / S.sweepPeriod) * TAU);
    const breathe = Math.sin((this.t / S.dollyPeriod) * TAU + 1.1) * S.dolly;
    const yaw = shotYaw(this.site.heading, S, phase) + parallax.x * S.parallaxYaw;
    const p = shotTarget(this.site.hero, yaw, S);
    this.target.set(p.x, ground, p.z);
    const post = rig.orbit(this.target, 0, {
      radius: S.radius * (1 + breathe),
      height: S.height * (1 + breathe * 0.6) + parallax.y * S.parallaxUp,
      fov: S.fov,
      start: yaw,
      tilt: 1,
    });
    post.focusBand = S.band;
    post.focusFeather = S.feather;
    post.focusY = Math.min(0.9, screenY(rig.camera, this.heroPoint.set(this.site.hero.x, kerb + 0.8, this.site.hero.z)) + S.focusLift);
    return post;
  }
}
