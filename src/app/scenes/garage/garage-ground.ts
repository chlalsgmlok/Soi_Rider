import {
  BoxGeometry, CanvasTexture, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion,
  RepeatWrapping, SRGBColorSpace, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE as P } from '../../../core/config/palette';
import { toonify } from '../../../engine/env/toonify';

/** the garage street: sidewalk from the shop fronts (z = 0) to the curb, road beyond (metres) */
export const STREET = { walk: 3.6, curbH: 0.15, halfLen: 22 } as const;

const mat = (color: string, roughness: number, extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial =>
  toonify(Object.assign(new MeshStandardMaterial({ color, roughness }), extra));

/** 40 cm square pavers with soft grout, one tile per texture repeat */
function tileTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#d9d2c8';
  g.fillRect(0, 0, 128, 5);
  g.fillRect(0, 0, 5, 128);
  g.fillStyle = 'rgba(0,0,0,0.04)';
  g.fillRect(12, 12, 104, 104);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/**
 * Ground of the garage set: a tiled sidewalk slab in front of the shop row, red-white striped curb stones and the
 * soi's asphalt with its gutter strip. A handful of draw calls; `dispose` frees every geometry/material/texture.
 */
export function buildGarageGround(): { root: Group; dispose(): void } {
  const root = new Group();
  root.name = 'garage_ground';
  const tiles = tileTexture();
  const L = STREET.halfLen * 2;
  tiles.repeat.set(L / 0.4, STREET.walk / 0.4);
  const walk = mat(P.sidewalk, 0.9, { map: tiles });
  const asphalt = mat(P.asphaltWet, 0.62, { metalness: 0.05 });
  const gutter = mat(P.concrete, 0.85);
  const red = mat(P.curbRed, 0.6);
  const white = mat(P.curbWhite, 0.6);

  const slabGeo = new BoxGeometry(L, STREET.curbH, STREET.walk);
  const slab = new Mesh(slabGeo, walk);
  slab.position.set(0, STREET.curbH / 2, STREET.walk / 2);
  const roadGeo = new PlaneGeometry(L * 2, 40);
  roadGeo.rotateX(-Math.PI / 2);
  const road = new Mesh(roadGeo, asphalt);
  road.position.set(0, 0, STREET.walk + 20);
  const gutterGeo = new PlaneGeometry(L, 0.32);
  gutterGeo.rotateX(-Math.PI / 2);
  const strip = new Mesh(gutterGeo, gutter);
  strip.position.set(0, 0.004, STREET.walk + 0.27);
  for (const m of [slab, road, strip]) {
    m.receiveShadow = true;
    root.add(m);
  }

  const curbGeo = new RoundedBoxGeometry(0.98, STREET.curbH + 0.04, 0.22, 1, 0.035);
  const n = Math.ceil(L);
  const reds = new InstancedMesh(curbGeo, red, Math.ceil(n / 2));
  const whites = new InstancedMesh(curbGeo, white, Math.ceil(n / 2));
  const m4 = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const at = new Vector3();
  let ri = 0;
  let wi = 0;
  for (let i = 0; i < n; i++) {
    m4.compose(at.set(-STREET.halfLen + 0.5 + i, (STREET.curbH + 0.04) / 2, STREET.walk - 0.1), q, one);
    if (i % 2) whites.setMatrixAt(wi++, m4);
    else reds.setMatrixAt(ri++, m4);
  }
  reds.count = ri;
  whites.count = wi;
  for (const im of [reds, whites]) {
    im.castShadow = true;
    im.receiveShadow = true;
    root.add(im);
  }

  return {
    root,
    dispose() {
      root.removeFromParent();
      for (const g of [slabGeo, roadGeo, gutterGeo, curbGeo]) g.dispose();
      for (const m of [walk, asphalt, gutter, red, white]) m.dispose();
      tiles.dispose();
      for (const im of [reds, whites]) im.dispose();
    },
  };
}
