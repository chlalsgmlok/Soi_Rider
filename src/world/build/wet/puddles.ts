import { CanvasTexture, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { Circle as Spot } from '../../../core/types';
import { toonify } from '../../../engine/env/toonify';
import { smoothstep } from '../../../core/math2d';

const Y = 0.016;

/** soft irregular blob (alpha) shared by every puddle */
function blobTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 128);
  const lobes: Array<[number, number, number, number]> = [[64, 64, 40, 30], [44, 58, 26, 22], [84, 70, 28, 20], [62, 46, 22, 18], [70, 84, 24, 16]];
  for (const [x, y, rx, ry] of lobes) {
    const grad = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.72, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.name = 'puddle_blob';
  return t;
}

/**
 * Rain puddles at the city's low spots: dark mirror-smooth blobs (the sky IBL does the reflection) that fade in with
 * road wetness. One InstancedMesh, hidden while dry.
 */
export class Puddles {
  readonly mesh: InstancedMesh;
  private readonly material: MeshStandardMaterial;
  private readonly alpha: CanvasTexture;

  constructor(spots: readonly Spot[]) {
    this.alpha = blobTexture();
    this.material = toonify(new MeshStandardMaterial({
      name: 'City_Puddles', color: '#4a4d55', roughness: 0.02, metalness: 0.55, transparent: true, opacity: 0,
      alphaMap: this.alpha, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
    }));
    const geo = new PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new InstancedMesh(geo, this.material, Math.max(1, spots.length));
    this.mesh.name = 'city_puddles';
    this.mesh.count = spots.length;
    this.mesh.renderOrder = 2;
    this.mesh.receiveShadow = true;
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const m = new Matrix4();
    spots.forEach((s: Spot, i) => {
      q.setFromAxisAngle(up, (i * 2.399) % (Math.PI * 2));
      m.compose(new Vector3(s.cx, Y, s.cz), q, new Vector3(s.r, 1, s.r * (0.7 + ((i * 7) % 5) * 0.08)));
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.computeBoundingSphere();
    this.mesh.visible = false;
  }

  setWet(wet: number): void {
    const a = smoothstep(0.12, 0.65, wet) * 0.92;
    this.material.opacity = a;
    this.mesh.visible = a > 0.01 && this.mesh.count > 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.alpha.dispose();
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}
