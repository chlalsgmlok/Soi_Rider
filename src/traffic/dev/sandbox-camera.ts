import { type PerspectiveCamera, Vector3 } from 'three';
import { CAMERA } from '../../core/config/camera';
import type { Vec2 } from '../../core/types';
import type { PostFxParams } from '../../engine/post/post-params';

export type CamMode = 'diorama' | 'orbit' | 'free';
export const CAM_MODES: readonly CamMode[] = ['diorama', 'orbit', 'free'];

const target = new Vector3();

/**
 * Traffic sandbox camera: 'diorama' = the mockup-03 framing (CAMERA.diorama: 11 m back, 12 m up, fov 36) behind the
 * rider marker, 'orbit' = drag to circle / wheel to zoom around it, 'free' = WASD to fly the focus over the city.
 */
export class SandboxCamera {
  mode: CamMode;
  private yaw: number;
  private zoom = 1;
  private readonly focus: Vec2;
  private readonly keys = new Set<string>();
  private dragX = -1;

  constructor(private readonly camera: PerspectiveCamera, canvas: HTMLCanvasElement, focus: Vec2, private heading: number, mode: CamMode, yaw: number, zoom = 1) {
    this.mode = mode;
    this.yaw = yaw;
    this.zoom = zoom;
    this.focus = { x: focus.x, z: focus.z };
    canvas.addEventListener('pointerdown', (e) => (this.dragX = e.clientX));
    addEventListener('pointerup', () => (this.dragX = -1));
    addEventListener('pointermove', (e) => {
      if (this.dragX < 0 || this.mode === 'diorama') return;
      this.yaw += (e.clientX - this.dragX) * 0.005;
      this.dragX = e.clientX;
    });
    canvas.addEventListener('wheel', (e) => (this.zoom = Math.min(6, Math.max(0.35, this.zoom * (e.deltaY > 0 ? 1.1 : 0.9)))), { passive: true });
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  update(dt: number): Partial<PostFxParams> {
    const d = CAMERA.diorama;
    if (this.mode === 'free') {
      const sp = 30 * this.zoom * dt;
      const fx = Math.sin(this.heading + this.yaw);
      const fz = Math.cos(this.heading + this.yaw);
      const k = (c: string): number => (this.keys.has(c) ? 1 : 0);
      const fwd = k('KeyW') - k('KeyS');
      const side = k('KeyA') - k('KeyD');
      this.focus.x += (fx * fwd + fz * side) * sp;
      this.focus.z += (fz * fwd - fx * side) * sp;
      this.yaw += (k('KeyQ') - k('KeyE')) * dt * 1.2;
    }
    const zoom = this.mode === 'diorama' ? 1 : this.zoom;
    const yaw = this.heading + this.yaw;
    this.camera.fov = d.fov;
    this.camera.position.set(this.focus.x - Math.sin(yaw) * d.back * zoom, d.up * zoom, this.focus.z - Math.cos(yaw) * d.back * zoom);
    target.set(this.focus.x + Math.sin(this.heading) * 3, 0.6, this.focus.z + Math.cos(this.heading) * 3);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    return { tiltShift: this.mode === 'free' ? 0.5 : d.tiltShift, focusY: 0.42, focusBand: 0.16, focusFeather: 0.3 };
  }

  /** keep the camera on a moving point (e.g. a pedestrian being watched) */
  follow(p: { x: number; z: number }, dt: number): void {
    const k = 1 - Math.exp(-dt * 4);
    this.focus.x += (p.x - this.focus.x) * k;
    this.focus.z += (p.z - this.focus.z) * k;
  }

  /** ground point the camera looks at (shadow focus) */
  get lookAt(): Vector3 {
    return target;
  }
}
