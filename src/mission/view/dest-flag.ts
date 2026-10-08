import {
  type BufferAttribute, CylinderGeometry, DataTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, NearestFilter,
  PlaneGeometry, SphereGeometry, SRGBColorSpace,
} from 'three';
import { PALETTE } from '../../core/config/palette';
import { clamp } from '../../core/math2d';
import type { Vec2 } from '../../core/types';
import { toonify } from '../../engine/env/toonify';

const POLE = 1.8;
const CLOTH_W = 0.72;
const CLOTH_H = 0.46;

/** 6 × 4 coral / cream checker (sRGB) */
function checker(): DataTexture {
  const w = 6;
  const h = 4;
  const data = new Uint8Array(w * h * 4);
  const a = [0xff, 0x4d, 0x5e];
  const b = [0xff, 0xf6, 0xe8];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = (x + y) % 2 === 0 ? a : b;
      data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  const t = new DataTexture(data, w, h);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * The little checkered flag planted on the curb at the destination (shown while the passenger is aboard): ink pole,
 * coral finial, a cloth that ripples in the wind (a 10 × 3 vertex grid animated on the CPU).
 */
export class DestFlag {
  readonly root = new Group();
  private readonly cloth: Mesh<PlaneGeometry, MeshStandardMaterial>;
  private readonly rest: Float32Array;
  private readonly owned: Array<{ dispose(): void }> = [];
  private time = 0;
  private show = 0;
  private wanted = false;

  constructor() {
    this.root.name = 'dest_flag';
    this.root.visible = false;
    const ink = toonify(new MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.5, metalness: 0.2 }));
    const coral = toonify(new MeshStandardMaterial({ color: PALETTE.pinCoral, roughness: 0.4, emissive: PALETTE.pinCoral, emissiveIntensity: 0.25 }));
    const map = checker();
    const clothMat = toonify(new MeshStandardMaterial({ map, side: DoubleSide, roughness: 0.75, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.12 }));
    const poleGeo = new CylinderGeometry(0.03, 0.04, POLE, 10).translate(0, POLE / 2, 0);
    const ballGeo = new SphereGeometry(0.075, 14, 10).translate(0, POLE + 0.05, 0);
    const clothGeo = new PlaneGeometry(CLOTH_W, CLOTH_H, 10, 3).translate(CLOTH_W / 2 + 0.03, POLE - CLOTH_H / 2 - 0.08, 0);
    this.cloth = new Mesh(clothGeo, clothMat);
    this.cloth.castShadow = true;
    const pole = new Mesh(poleGeo, ink);
    pole.castShadow = true;
    this.root.add(pole, new Mesh(ballGeo, coral), this.cloth);
    this.rest = (clothGeo.getAttribute('position').array as Float32Array).slice();
    this.owned.push(ink, coral, map, clothMat, poleGeo, ballGeo, clothGeo);
  }

  /** plant at `pos` (ground height, cloth pointing along `yaw`'s right), or null to fold it away */
  place(pos: Vec2 | null, groundY = 0, yaw = 0): void {
    this.wanted = pos !== null;
    if (!pos) return;
    this.root.position.set(pos.x, groundY, pos.z);
    this.root.rotation.y = yaw;
  }

  update(dt: number): void {
    this.time += dt;
    this.show = clamp(this.show + (this.wanted ? dt * 2 : -dt * 3), 0, 1);
    this.root.visible = this.show > 0.001;
    if (!this.root.visible) return;
    this.root.scale.set(1, this.show * this.show * (3 - 2 * this.show), 1);
    const attr = this.cloth.geometry.getAttribute('position') as BufferAttribute;
    const p = attr.array as Float32Array;
    const t = this.time;
    for (let i = 0; i < p.length; i += 3) {
      const u = clamp((this.rest[i] - 0.03) / CLOTH_W, 0, 1);
      p[i + 2] = Math.sin(t * 5.2 - u * 5.5) * 0.09 * u + Math.sin(t * 8.3 - u * 9) * 0.02 * u;
      p[i + 1] = this.rest[i + 1] - u * u * 0.05;
    }
    attr.needsUpdate = true;
    this.cloth.geometry.computeVertexNormals();
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const o of this.owned) o.dispose();
  }
}
