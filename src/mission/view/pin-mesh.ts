import { CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape } from 'three';
import { PALETTE } from '../../core/config/palette';
import { toonify } from '../../engine/env/toonify';

/** pin head radius and tip-to-head-centre height (m) — the authored pin is about 2.1 m tall */
export const PIN_R = 0.62;
export const PIN_H = 1.5;
const DEPTH = 0.26;
const BEVEL = 0.08;

/** teardrop outline: tip at the origin, head circle centred at (0, PIN_H) */
function pinShape(): Shape {
  const a = Math.acos(PIN_R / PIN_H);
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(Math.cos(-Math.PI / 2 + a) * PIN_R, PIN_H + Math.sin(-Math.PI / 2 + a) * PIN_R);
  s.absarc(0, PIN_H, PIN_R, -Math.PI / 2 + a, (3 * Math.PI) / 2 - a, false);
  s.lineTo(0, 0);
  return s;
}

/**
 * The coral map pin of mockup 03 as a chunky toy: bevelled teardrop with a cream inset disc on both faces, toon
 * shaded with a little emission so it stays vivid at dusk and night. Origin = the tip.
 */
export function buildPinMesh(): { root: Group; dispose(): void } {
  const root = new Group();
  root.name = 'gram_pin';
  const body = new ExtrudeGeometry(pinShape(), {
    depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: 0.07, bevelSegments: 3, curveSegments: 28,
  });
  body.translate(0, 0, -DEPTH / 2);
  const disc = new CylinderGeometry(0.26, 0.26, DEPTH + BEVEL * 2 + 0.03, 32);
  disc.rotateX(Math.PI / 2);
  disc.translate(0, PIN_H, 0);
  const coral = toonify(new MeshStandardMaterial({
    name: 'Pin_Coral', color: PALETTE.pinCoral, roughness: 0.38, metalness: 0, emissive: PALETTE.pinCoral, emissiveIntensity: 0.32,
  }));
  const cream = toonify(new MeshStandardMaterial({
    name: 'Pin_Cream', color: PALETTE.cream, roughness: 0.5, metalness: 0, emissive: PALETTE.cream, emissiveIntensity: 0.3,
  }));
  const bodyMesh = new Mesh(body, coral);
  const discMesh = new Mesh(disc, cream);
  bodyMesh.castShadow = true;
  discMesh.castShadow = false;
  root.add(bodyMesh, discMesh);
  return {
    root,
    dispose(): void {
      body.dispose();
      disc.dispose();
      coral.dispose();
      cream.dispose();
    },
  };
}
