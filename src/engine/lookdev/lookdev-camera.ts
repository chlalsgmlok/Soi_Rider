import type { Mesh, Object3D, PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { CAMERA } from '../../core/config/camera';
import { findNode } from '../assets/material-tools';
import type { PostFxParams } from '../post/post-params';

export type LookdevView = 'diorama' | 'squeeze' | 'pov' | 'top';
export const LOOKDEV_VIEWS: readonly LookdevView[] = ['diorama', 'squeeze', 'pov', 'top'];

const target = new Vector3();
const bodyMeshes = new WeakMap<Object3D, Object3D[]>();

/** in POV only the rider's forearms + hands stay visible (the real cockpit lives in src/player) */
function setPovBody(player: Object3D, pov: boolean): void {
  let list = bodyMeshes.get(player);
  if (!list) {
    list = [];
    const body = findNode(player, 'hips')?.parent;
    body?.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      let keep = false;
      for (let p: Object3D | null = o; p && p !== body; p = p.parent) if (/^(forearm|hand)_/.test(p.name)) keep = true;
      if (!keep) list?.push(o);
    });
    bodyMeshes.set(player, list);
  }
  for (const m of list) m.visible = !pov;
}
const offset = new Vector3();

/**
 * Static framings for look-dev that mirror docs/GAME_DESIGN.md §12 (the real rig lives in src/camera):
 * diorama = mockup 03 (high 3/4, fov 36, strong tilt-shift), squeeze = close chase, pov = mockup 02 handlebars.
 */
export function frameLookdev(
  camera: PerspectiveCamera, view: LookdevView, focus: Vector3, heading: number, yawOffset: number, player: Object3D,
): Partial<PostFxParams> {
  setPovBody(player, view === 'pov');
  const yaw = heading + yawOffset;
  const fwdX = Math.sin(heading);
  const fwdZ = Math.cos(heading);
  if (view === 'diorama') {
    const d = CAMERA.diorama;
    offset.set(-Math.sin(yaw) * d.back, d.up, -Math.cos(yaw) * d.back);
    // mockup 03 composition: the bike sits ~70 % down the frame inside the sharp band (the live rig is src/camera)
    const ahead = d.lookAhead * 0.5;
    target.set(focus.x + fwdX * ahead, 0.6, focus.z + fwdZ * ahead);
    camera.fov = d.fov;
    camera.position.copy(focus).add(offset);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    return { tiltShift: d.tiltShift, focusY: 0.4, focusBand: 0.15, focusFeather: 0.28 };
  }
  if (view === 'squeeze') {
    const d = CAMERA.squeeze;
    offset.set(-Math.sin(yaw) * d.back, d.up, -Math.cos(yaw) * d.back);
    target.set(focus.x + fwdX * d.lookAhead, 0.9, focus.z + fwdZ * d.lookAhead);
    camera.fov = d.fov;
    camera.position.copy(focus).add(offset);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    return { tiltShift: d.tiltShift, focusY: 0.4, focusBand: 0.22, focusFeather: 0.3 };
  }
  if (view === 'pov') {
    const d = CAMERA.pov;
    camera.fov = d.fov;
    camera.position.set(focus.x - fwdX * d.eyeBack, d.eyeUp, focus.z - fwdZ * d.eyeBack);
    target.set(focus.x + fwdX * 20, 0.9, focus.z + fwdZ * 20);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    return { tiltShift: 0, focusY: 0.5, focusBand: 0.3, focusFeather: 0.3 };
  }
  camera.fov = 40;
  camera.position.set(focus.x + 0.01, 70, focus.z - 8);
  camera.lookAt(focus.x, 0, focus.z + 6);
  camera.updateProjectionMatrix();
  return { tiltShift: 0, focusY: 0.5, focusBand: 0.3, focusFeather: 0.3 };
}
