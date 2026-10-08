import { BufferGeometry, type Mesh, type Object3D } from 'three';
import { isMesh } from '../../engine/assets/material-guards';

const EMPTY = new BufferGeometry();

/**
 * Hides the rider's head, helmet, torso and upper arms for the POV camera (forearms, gloves and legs stay, so the
 * cockpit shows hands on the grips). Node meshes get an empty geometry (their children must keep rendering);
 * multi-material nodes hide their primitive meshes; attachments (helmet, outfit) are hidden outright.
 */
export class FirstPersonMask {
  private readonly swapped = new Map<Mesh, Mesh['geometry']>();
  private readonly hidden: Object3D[] = [];
  private on = false;

  get active(): boolean {
    return this.on;
  }

  apply(nodes: Object3D[], attachments: Array<Object3D | null>): void {
    this.clear();
    this.on = true;
    for (const n of nodes) {
      if (isMesh(n)) {
        // a single-material joint IS the mesh: empty its geometry, its child joints keep rendering
        this.swapped.set(n, n.geometry);
        n.geometry = EMPTY;
        continue;
      }
      // a multi-material joint is a group whose direct mesh children are its primitives
      for (const c of n.children) {
        if (!isMesh(c)) continue;
        c.visible = false;
        this.hidden.push(c);
      }
    }
    for (const a of attachments) {
      if (!a) continue;
      a.visible = false;
      this.hidden.push(a);
    }
  }

  clear(): void {
    for (const [mesh, geo] of this.swapped) mesh.geometry = geo;
    this.swapped.clear();
    for (const o of this.hidden) o.visible = true;
    this.hidden.length = 0;
    this.on = false;
  }
}
