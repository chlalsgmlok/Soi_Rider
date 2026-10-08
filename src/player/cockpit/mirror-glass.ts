import {
  CanvasTexture, HalfFloatType, type Material, MeshBasicMaterial, type Mesh, type Object3D, PerspectiveCamera,
  SRGBColorSpace, Vector3, WebGLRenderTarget,
} from 'three';
import { isMesh } from '../../engine/assets/material-guards';
import { findNode, matchesMaterial } from '../../engine/assets/material-tools';

let stylised: CanvasTexture | null = null;

/** a painted "rear view": warm sky, hazy horizon, road and a couple of blurred tail-light blobs, plus a glint */
function stylisedTexture(): CanvasTexture {
  if (stylised) return stylised;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d');
  if (!g) throw new Error('[mirror] 2D canvas unavailable');
  const sky = g.createLinearGradient(0, 0, 0, 96);
  sky.addColorStop(0, '#ffd9a8');
  sky.addColorStop(0.45, '#d9b9c4');
  sky.addColorStop(0.55, '#77707e');
  sky.addColorStop(1, '#4b4752');
  g.fillStyle = sky;
  g.fillRect(0, 0, 128, 96);
  g.filter = 'blur(4px)';
  g.fillStyle = 'rgba(60,58,70,0.8)';
  g.fillRect(14, 36, 46, 26);
  g.fillRect(78, 40, 30, 20);
  g.fillStyle = 'rgba(255,90,70,0.9)';
  for (const [x, y] of [[18, 52], [52, 52], [82, 54], [102, 54]]) g.fillRect(x, y, 6, 4);
  g.filter = 'none';
  const glint = g.createLinearGradient(0, 0, 128, 96);
  glint.addColorStop(0.25, 'rgba(255,255,255,0)');
  glint.addColorStop(0.32, 'rgba(255,255,255,0.45)');
  glint.addColorStop(0.38, 'rgba(255,255,255,0)');
  g.fillStyle = glint;
  g.fillRect(0, 0, 128, 96);
  stylised = new CanvasTexture(c);
  stylised.colorSpace = SRGBColorSpace;
  return stylised;
}

const mp = new Vector3();
const back = new Vector3();

/**
 * One handlebar mirror's glass in POV: either the painted rear view (low/medium) or a live reflection rendered
 * from a small camera at the mirror looking back-and-out (high). Swaps the GLB `Glass` material while active.
 */
export class MirrorGlass {
  private glass: Mesh | null = null;
  private original: Material | Material[] | null = null;
  private readonly mat: MeshBasicMaterial;
  private rt: WebGLRenderTarget | null = null;
  readonly cam = new PerspectiveCamera(46, 1.3, 0.3, 160);

  constructor(private readonly side: 1 | -1) {
    this.mat = new MeshBasicMaterial({ map: stylisedTexture(), color: '#e6e6e6', fog: false });
  }

  bind(bike: Object3D): void {
    this.setActive(false);
    this.glass = null;
    findNode(bike, this.side > 0 ? 'mirror_L' : 'mirror_R')?.traverse((o) => {
      if (isMesh(o) && !Array.isArray(o.material) && matchesMaterial(o.material, 'Glass')) this.glass = o;
    });
  }

  setReflective(on: boolean): void {
    if (on && !this.rt) {
      this.rt = new WebGLRenderTarget(192, 144, { type: HalfFloatType });
      const t = this.rt.texture;
      t.repeat.set(-1, 1);
      t.offset.set(1, 0);
      this.mat.map = t;
    } else if (!on && this.rt) {
      this.rt.dispose();
      this.rt = null;
      this.mat.map = stylisedTexture();
    }
    this.mat.color.set(on ? '#d0d0d0' : '#e6e6e6');
    this.mat.needsUpdate = true;
  }

  setActive(on: boolean): void {
    const g = this.glass;
    if (!g) return;
    if (on && !this.original) {
      this.original = g.material;
      g.material = this.mat;
    } else if (!on && this.original) {
      g.material = this.original;
      this.original = null;
    }
  }

  /** dim the painted view at night */
  tint(night: number): void {
    if (!this.rt) this.mat.color.setScalar(0.9 - 0.6 * night);
  }

  /** aim the mirror camera: from the glass, backwards and a little outward (bike yaw `heading`) */
  aim(heading: number): WebGLRenderTarget | null {
    if (!this.rt || !this.glass) return null;
    this.glass.getWorldPosition(mp);
    back.set(-Math.sin(heading) + Math.cos(heading) * 0.22 * this.side, 0.03, -Math.cos(heading) - Math.sin(heading) * 0.22 * this.side);
    this.cam.position.copy(mp);
    this.cam.lookAt(mp.add(back));
    this.cam.updateMatrixWorld();
    return this.rt;
  }

  dispose(): void {
    this.setActive(false);
    this.rt?.dispose();
    this.mat.dispose();
  }
}
