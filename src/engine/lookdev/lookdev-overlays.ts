import {
  BoxGeometry, CatmullRomCurve3, ConeGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, type Object3D, Quaternion, RingGeometry, SphereGeometry, TubeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE as P } from '../../core/config/palette';
import { findNode } from '../assets/material-tools';
import { toonify } from '../env/toonify';

/**
 * Stand-ins for the in-world UI of mockup 03 (gram cyan dashed route with chevrons, ring under the bike, coral pin)
 * and the overhead cable bundles — so the grade can be judged with the real accent colours in frame.
 */
export function buildRouteOverlay(points: Vector3[], ringAt: Vector3, pinAt: Vector3): Group {
  const g = new Group();
  g.name = 'lookdev_route';
  const cyan = new MeshBasicMaterial({ color: P.gramCyan, transparent: true, opacity: 0.92, depthWrite: false, fog: false });
  cyan.color.multiplyScalar(1.6);
  const curve = new CatmullRomCurve3(points);
  const len = curve.getLength();
  const n = Math.floor(len / 1.1);
  const dashes = new InstancedMesh(new BoxGeometry(0.16, 0.01, 0.6), cyan, n);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = curve.getPointAt(t);
    const d = curve.getTangentAt(t);
    q.setFromAxisAngle(up, Math.atan2(d.x, d.z));
    m.compose(p.setY(0.03), q, new Vector3(1, 1, 1));
    dashes.setMatrixAt(i, m);
  }
  dashes.renderOrder = 5;
  g.add(dashes);

  const ring = new Mesh(new RingGeometry(0.95, 1.08, 48), cyan);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(ringAt).setY(0.03);
  ring.renderOrder = 5;
  g.add(ring);

  const coral = toonify(new MeshStandardMaterial({ color: P.pinCoral, roughness: 0.35, emissive: P.pinCoral, emissiveIntensity: 0.35 }));
  const head = new SphereGeometry(0.42, 20, 14);
  head.translate(0, 2.25, 0);
  const tip = new ConeGeometry(0.36, 0.8, 20);
  tip.rotateX(Math.PI);
  tip.translate(0, 1.72, 0);
  const pin = new Mesh(mergeGeometries([head.toNonIndexed(), tip.toNonIndexed()]), coral);
  pin.position.copy(pinAt);
  pin.castShadow = true;
  g.add(pin);
  return g;
}

/** sagging cable bundles between consecutive poles' wire_* empties */
export function buildWires(poles: Object3D[]): Mesh | null {
  const geos: TubeGeometry[] = [];
  const a = new Vector3();
  const b = new Vector3();
  for (let i = 0; i + 1 < poles.length; i++) {
    for (let w = 0; w < 4; w++) {
      const na = findNode(poles[i], `wire_${w}`);
      const nb = findNode(poles[i + 1], `wire_${w}`);
      if (!na || !nb) continue;
      na.getWorldPosition(a);
      nb.getWorldPosition(b);
      for (let extra = 0; extra < 2; extra++) {
        const off = extra * 0.12;
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.9 + w * 0.15 + extra * 0.35;
        const curve = new CatmullRomCurve3([a.clone().setY(a.y - off), mid, b.clone().setY(b.y - off)]);
        geos.push(new TubeGeometry(curve, 16, 0.022 + extra * 0.01, 4, false));
      }
    }
  }
  if (!geos.length) return null;
  const mesh = new Mesh(mergeGeometries(geos), toonify(new MeshStandardMaterial({ color: '#1d1f24', roughness: 0.7 })));
  for (const g of geos) g.dispose();
  mesh.castShadow = true;
  mesh.name = 'lookdev_wires';
  return mesh;
}
