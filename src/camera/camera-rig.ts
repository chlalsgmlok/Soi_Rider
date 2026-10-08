import { type PerspectiveCamera, Vector3 } from 'three';
import { angleDiff, damp, KMH } from '../core/math2d';
import { CAMERA } from '../core/config/camera';
import type { CameraMode, ClearanceInfo, PlayerState } from '../core/types';
import { CURB_HEIGHT, isRaised } from '../physics/curb-detector';
import { AutoSqueeze } from './auto-squeeze';
import { CameraClip, type CameraWorld } from './camera-clip';
import { applyPose, blendPose, type CameraPost, copyPose, newPose, screenY } from './camera-pose';
import { CameraShake } from './camera-shake';
import { EventShot, type EventShotKind } from './event-shot';
import { DioramaYaw } from './diorama-yaw';
import { DIORAMA_YAW, dioramaPose, type FrameInput, povPose, squeezePose } from './framings';
import { orbitPose, type OrbitOptions } from './orbit';

const MODES: readonly CameraMode[] = ['auto', 'diorama', 'pov'];
/** a camera-mode change cross-fades over this long (s) */
const SWITCH_TIME = 0.55;
const shakeOff = new Vector3();
const focus = new Vector3();
const pivot = new Vector3();

/**
 * The player camera (docs/GAME_DESIGN.md §12): AUTO (diorama ⇄ squeeze by clearance/speed with hysteresis),
 * DIORAMA, POV; keeps chase cameras out of buildings, shakes, plays event shots (boarding orbit, crash cam with a
 * slow-mo hint), orbits for title/garage, and returns the tilt-shift band centred on the bike.
 */
export class CameraRig {
  mode: CameraMode = 'auto';
  readonly squeeze = new AutoSqueeze();
  private readonly shaker = new CameraShake();
  private readonly clip = new CameraClip();
  private readonly dyaw = new DioramaYaw();
  private readonly event = new EventShot();
  private world: CameraWorld | null = null;
  private frame: FrameInput | null = null;
  private readonly pose = { a: newPose(), b: newPose(), ev: newPose(), from: newPose(), out: newPose() };
  private readonly post: CameraPost = { tiltShift: 1, focusY: 0.35, focusBand: 0.14, focusFeather: 0.28 };
  private switchT = 1;
  private fresh = true;
  /** a shot asked for before the first update (no player state yet) starts on that update */
  private queued: { kind: EventShotKind; target: Vector3 | null; seconds: number } | null = null;

  constructor(readonly camera: PerspectiveCamera, opts: { reducedMotion?: boolean } = {}) {
    this.shaker.enabled = !opts.reducedMotion;
  }

  set reducedMotion(on: boolean) {
    this.shaker.enabled = !on;
  }

  /** world used to keep the camera out of buildings (CityQuery or anything with surfaceAt) */
  setWorld(world: CameraWorld | null): void {
    this.world = world;
    this.clip.reset();
    this.dyaw.reset();
  }

  setMode(m: CameraMode): void {
    if (m === this.mode) return;
    copyPose(this.pose.from, this.pose.out);
    this.switchT = this.fresh ? 1 : 0;
    this.mode = m;
  }

  /** AUTO → DIORAMA → POV → AUTO (the C key); returns the new mode */
  cycleMode(): CameraMode {
    this.setMode(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]);
    return this.mode;
  }

  shake(strength: number, seconds: number): void {
    this.shaker.add(strength, seconds);
  }

  eventShot(kind: EventShotKind, target: Vector3 | null, seconds: number): void {
    if (this.frame) this.event.start(kind, this.frame.s, target, seconds);
    else this.queued = { kind, target: target ? target.clone() : null, seconds };
  }

  /** GameLoop.timeScale the current shot asks for (slow-mo at the start of a crash) */
  get timeScale(): number {
    return this.event.timeScale;
  }

  /** the first-person view is what's on screen (show the cockpit, hide the rider's head) */
  get povActive(): boolean {
    return this.mode === 'pov' && this.switchT > 0.5 && this.event.weight < 0.5;
  }

  /** jump to the target framing on the next update (scene cuts, teleports) */
  snap(): void {
    this.fresh = true;
  }

  update(dt: number, s: PlayerState, clearance: ClearanceInfo | null): CameraPost {
    const ground = isRaised(s.surface) ? CURB_HEIGHT : 0;
    const f = (this.frame ??= { s, yaw: s.heading, ground, time: 0, yawOffset: DIORAMA_YAW });
    f.s = s;
    f.time += dt;
    if (this.queued) {
      this.event.start(this.queued.kind, s, this.queued.target, this.queued.seconds);
      this.queued = null;
    }
    if (this.fresh) {
      f.yaw = s.heading;
      f.ground = ground;
    }
    f.yaw += angleDiff(f.yaw, s.heading) * damp(1 / CAMERA.diorama.yawLag, dt);
    f.ground += (ground - f.ground) * damp(8, dt);

    const { a, b, ev, from, out } = this.pose;
    if (this.mode === 'pov') povPose(f, out);
    else {
      f.yawOffset = this.dyaw.update(dt, this.world, s, f.yaw, f.ground, this.fresh);
      dioramaPose(f, a);
      const gap = clearance ? Math.min(clearance.left, clearance.right) : Infinity;
      const w = this.mode === 'auto' ? this.squeeze.update(dt, gap, Math.abs(s.speed) * KMH, s.fallen) : 0;
      if (w > 0) blendPose(a, squeezePose(f, b), w, out);
      else copyPose(out, a);
      if (this.fresh) this.clip.reset();
      this.clip.apply(dt, this.world, pivot.set(s.pos.x, f.ground + 1.2, s.pos.z), out.pos);
    }
    const ew = this.event.weight;
    if (this.event.active) {
      this.event.update(dt, s, f.ground, ev);
      blendPose(out, ev, ew, out);
    }
    if (this.switchT < 1) {
      this.switchT = Math.min(1, this.switchT + dt / SWITCH_TIME);
      const t = this.switchT * this.switchT * (3 - 2 * this.switchT);
      blendPose(from, out, t, out);
    }
    this.fresh = false;
    return this.finish(dt, s, f.ground);
  }

  /** title / garage: orbit `target` (t = seconds); returns the post params for the shot */
  orbit(target: Vector3, t: number, opts: OrbitOptions = {}): CameraPost {
    orbitPose(target, t, opts, this.pose.out);
    this.fresh = true;
    applyPose(this.camera, this.pose.out);
    focus.copy(target);
    return this.toPost(this.pose.out.tilt, this.pose.out.band, this.pose.out.feather, focus);
  }

  private finish(dt: number, s: PlayerState, ground: number): CameraPost {
    const out = this.pose.out;
    const roll = this.shaker.update(dt, shakeOff);
    out.pos.add(shakeOff);
    out.roll += roll;
    applyPose(this.camera, out);
    out.pos.sub(shakeOff);
    out.roll -= roll;
    focus.set(s.pos.x, ground + 0.7, s.pos.z);
    return this.toPost(out.tilt, out.band, out.feather, focus);
  }

  private toPost(tilt: number, band: number, feather: number, at: Vector3): CameraPost {
    const p = this.post;
    p.tiltShift = tilt;
    p.focusY = tilt > 0.01 ? screenY(this.camera, at) + band * 0.35 : 0.5;
    p.focusBand = band;
    p.focusFeather = feather;
    return p;
  }
}
