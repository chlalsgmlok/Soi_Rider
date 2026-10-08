import {
  BoxGeometry, Group, InstancedMesh, type Material, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE as P } from '../../core/config/palette';
import { toonify } from '../env/toonify';

/**
 * Look-dev ground for a Bangkok corner: 4-lane main road along Z (x −7..7), a soi joining from +X at z 6..13,
 * raised sidewalks with red-white striped curbs, lane dashes, centre line and a zebra crossing.
 * Instanced so the whole ground is a handful of draw calls.
 */
export const ROAD = { half: 7, soiZ0: 6, soiZ1: 13, walk: 3.2, curbH: 0.16, len: 140 } as const;

const mat = (color: string, roughness: number, extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial =>
  toonify(Object.assign(new MeshStandardMaterial({ color, roughness }), extra));

interface Rect { x0: number; x1: number; z0: number; z1: number }

export function buildStreetGround(): { root: Group; asphalt: MeshStandardMaterial; materials: Material[] } {
  const root = new Group();
  root.name = 'lookdev_ground';
  const asphalt = mat(P.asphalt, 0.88);
  const walk = mat(P.sidewalk, 0.92);
  const red = mat(P.curbRed, 0.6);
  const white = mat(P.curbWhite, 0.6);
  const paint = mat(P.laneWhite, 0.7, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const yellow = mat(P.laneYellow, 0.7, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  const road = new Mesh(new PlaneGeometry(400, 400), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  root.add(road);

  const L = ROAD.len;
  const H = ROAD.half;
  const W = ROAD.walk;
  const blocks: Rect[] = [
    { x0: -H - W - 60, x1: -H, z0: -L, z1: L },
    { x0: H, x1: H + W + 60, z0: -L, z1: ROAD.soiZ0 },
    { x0: H, x1: H + W + 60, z0: ROAD.soiZ1, z1: L },
  ];
  const slab = new BoxGeometry(1, ROAD.curbH, 1);
  const slabs = new InstancedMesh(slab, walk, blocks.length);
  const m = new Matrix4();
  const q = new Quaternion();
  blocks.forEach((b, i) => {
    m.compose(new Vector3((b.x0 + b.x1) / 2, ROAD.curbH / 2, (b.z0 + b.z1) / 2), q, new Vector3(b.x1 - b.x0, 1, b.z1 - b.z0));
    slabs.setMatrixAt(i, m);
  });
  slabs.receiveShadow = true;
  slabs.castShadow = true;
  root.add(slabs);

  // curb stones: 1 m segments alternating red / white along every road-facing edge
  const curbSegs: Array<{ x: number; z: number; rot: number }> = [];
  const along = (x: number, z0: number, z1: number): void => {
    for (let z = z0 + 0.5; z < z1; z += 1) curbSegs.push({ x, z, rot: 0 });
  };
  const across = (z: number, x0: number, x1: number): void => {
    for (let x = x0 + 0.5; x < x1; x += 1) curbSegs.push({ x, z, rot: Math.PI / 2 });
  };
  along(-H - 0.11, -60, 60);
  along(H + 0.11, -60, ROAD.soiZ0);
  along(H + 0.11, ROAD.soiZ1, 60);
  across(ROAD.soiZ0 - 0.11, H, H + 40);
  across(ROAD.soiZ1 + 0.11, H, H + 40);
  const curbGeo = new RoundedBoxGeometry(0.98, ROAD.curbH + 0.04, 0.24, 1, 0.04);
  const reds = new InstancedMesh(curbGeo, red, Math.ceil(curbSegs.length / 2));
  const whites = new InstancedMesh(curbGeo, white, Math.ceil(curbSegs.length / 2));
  let ri = 0;
  let wi = 0;
  const up = new Vector3(0, 1, 0);
  curbSegs.forEach((c, i) => {
    m.compose(new Vector3(c.x, (ROAD.curbH + 0.04) / 2, c.z), q.setFromAxisAngle(up, c.rot + Math.PI / 2), new Vector3(1, 1, 1));
    if (i % 2) whites.setMatrixAt(wi++, m);
    else reds.setMatrixAt(ri++, m);
  });
  reds.count = ri;
  whites.count = wi;
  for (const im of [reds, whites]) {
    im.castShadow = true;
    im.receiveShadow = true;
    root.add(im);
  }

  // markings
  const stripe = new BoxGeometry(1, 0.02, 1);
  const marks: Array<[number, number, number, number]> = [];
  for (let z = -60; z < 60; z += 6) {
    if (z > ROAD.soiZ0 - 8 && z < ROAD.soiZ1 + 1) continue;
    marks.push([3.5, z, 0.15, 3], [-3.5, z, 0.15, 3]);
  }
  for (let x = -H + 0.6; x < H - 0.3; x += 1.0) marks.push([x, ROAD.soiZ0 - 3.2, 0.5, 2.6]);
  marks.push([H / 2 + 0.1, ROAD.soiZ0 - 5.2, H - 0.4, 0.35]);
  const whiteMarks = new InstancedMesh(stripe, paint, marks.length);
  marks.forEach(([x, z, w, l], i) => {
    m.compose(new Vector3(x, 0.01, z), q.identity(), new Vector3(w, 1, l));
    whiteMarks.setMatrixAt(i, m);
  });
  whiteMarks.receiveShadow = true;
  root.add(whiteMarks);
  // double yellow centre line, interrupted by the crossing and the junction box
  const spans: Array<[number, number]> = [[-60, ROAD.soiZ0 - 5.6], [ROAD.soiZ1 + 1, 60]];
  const centre = new InstancedMesh(stripe, yellow, spans.length * 2);
  let ci = 0;
  for (const [z0, z1] of spans) {
    for (const x of [0.12, -0.12]) {
      m.compose(new Vector3(x, 0.011, (z0 + z1) / 2), q.identity(), new Vector3(0.12, 1, z1 - z0));
      centre.setMatrixAt(ci++, m);
    }
  }
  centre.receiveShadow = true;
  root.add(centre);
  return { root, asphalt, materials: [asphalt, walk, red, white, paint, yellow] };
}
