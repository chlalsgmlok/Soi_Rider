import { Mesh, type ShaderMaterial } from 'three';
import type { RoutePath } from '../nav/route-path';
import { type GroundFn, RouteRibbon } from './route-ribbon';
import { createRouteMaterial } from './route-shader';

/** a fresh route fades in over this long (s) */
const FADE_IN = 0.45;

/**
 * The gram route on the road (mockup 03): cyan dashed ribbon with chevrons, dashes flowing toward the target, soft
 * glow, faded right under the bike and far ahead. `setPath` rebuilds the ribbon in place (re-route), `update` moves
 * the head (the rider's arc position on the route) and the flow clock.
 */
export class RouteLine {
  readonly mesh: Mesh;
  private readonly ribbon = new RouteRibbon();
  private readonly mat: ShaderMaterial;
  private path: RoutePath | null = null;
  private time = 0;
  private fade = 0;
  private shown = true;

  constructor(private readonly ground: GroundFn = () => 0) {
    this.mat = createRouteMaterial();
    this.mesh = new Mesh(this.ribbon.geometry, this.mat);
    this.mesh.name = 'gram_route';
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  /** the drawn route (null hides the line); a new path object rebuilds the ribbon */
  setPath(path: RoutePath | null): void {
    if (path === this.path) return;
    // a route shorter than this is the target itself: nothing worth drawing
    this.path = path && path.length > 0.5 ? path : null;
    if (this.path) {
      this.ribbon.build(this.path, this.ground);
      this.mat.uniforms.uLength.value = this.path.length;
      this.fade = 0;
    }
    this.mesh.visible = this.shown && this.path !== null;
  }

  /** hide / show without dropping the path (POV, cut-scenes) */
  setVisible(on: boolean): void {
    this.shown = on;
    this.mesh.visible = on && this.path !== null;
  }

  /**
   * @param head rider's arc position along the route (Navigator.s)
   * @param night Environment.night (the glow carries more at night)
   */
  update(dt: number, head: number, night = 0): void {
    this.time += dt;
    this.fade = Math.min(1, this.fade + dt / FADE_IN);
    const u = this.mat.uniforms;
    u.uTime.value = this.time;
    u.uHead.value = head;
    u.uOpacity.value = this.fade * this.fade * (3 - 2 * this.fade);
    u.uGlow.value = 0.36 + 0.4 * night;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.ribbon.dispose();
    this.mat.dispose();
  }
}
