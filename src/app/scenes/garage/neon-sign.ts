import {
  AdditiveBlending, CanvasTexture, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE as P } from '../../../core/config/palette';
import { toonify } from '../../../engine/env/toonify';

/** px per metre of the tube artwork */
const PPM = 420;
/** HDR boost so the tubes clear the night bloom threshold */
const GLOW = 2.2;

/** neon tubes: a wide coloured halo, the tube, then a hot white core */
function tube(g: CanvasRenderingContext2D, color: string, draw: () => void): void {
  g.lineJoin = g.lineCap = 'round';
  for (const [w, blur, a] of [[22, 34, 0.55], [12, 14, 0.9]] as const) {
    g.globalAlpha = a;
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.strokeStyle = color;
    g.lineWidth = w;
    draw();
  }
  g.globalAlpha = 0.55;
  g.shadowBlur = 0;
  g.strokeStyle = '#fff7fb';
  g.lineWidth = 3;
  draw();
  g.globalAlpha = 1;
}

/** filled glyphs for Thai (outlined tubes would double every loop and blur the script): halo, colour, warm core */
function lit(g: CanvasRenderingContext2D, color: string, draw: () => void): void {
  g.shadowColor = color;
  for (const [blur, a] of [[36, 0.6], [14, 1]] as const) {
    g.globalAlpha = a;
    g.shadowBlur = blur;
    g.fillStyle = color;
    draw();
  }
  g.shadowBlur = 0;
  g.globalAlpha = 0.35;
  g.fillStyle = '#fff7fb';
  draw();
  g.globalAlpha = 1;
}

function panel(w: number, h: number, paint: (g: CanvasRenderingContext2D, W: number, H: number) => void): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const c = document.createElement('canvas');
  c.width = Math.round(w * PPM);
  c.height = Math.round(h * PPM);
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  paint(g, c.width, c.height);
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  const m = new MeshBasicMaterial({ map, blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  m.color.setScalar(GLOW);
  return new Mesh(new PlaneGeometry(w, h), m);
}

/**
 * A shop neon hanging under the awning: a cyan "วิน" badge (the motorbike-taxi sign) beside a pink "SOI 23" that
 * stutters now and then like an old transformer. `level` (0..1) of the flickering half drives its light spill.
 */
export class NeonSign {
  readonly root = new Group();
  /** brightness of the flickering pink tube (light spill follows it) */
  level = 1;
  private readonly badge: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly word: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly plate: Mesh<RoundedBoxGeometry, MeshStandardMaterial>;
  private t = 0;
  private next = 6;

  constructor() {
    this.root.name = 'neon_sign';
    this.badge = panel(0.62, 0.5, (g, W, H) => {
      tube(g, P.neonCyan, () => g.strokeRect(22, 22, W - 44, H - 44));
      g.font = '600 120px Kanit, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      lit(g, P.neonCyan, () => g.fillText('วิน', W / 2, H / 2 + 6));
    });
    this.word = panel(1.15, 0.5, (g, W, H) => {
      g.font = 'italic 800 118px Kanit, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      tube(g, P.neonPink, () => g.strokeText('SOI 23', W / 2, H / 2 + 6));
    });
    this.badge.position.x = -0.6;
    this.word.position.x = 0.32;
    this.plate = new Mesh(
      new RoundedBoxGeometry(1.95, 0.6, 0.05, 2, 0.03),
      toonify(new MeshStandardMaterial({ color: '#1b1e29', roughness: 0.4, metalness: 0.1 })),
    );
    this.plate.position.set(-0.06, 0, -0.035);
    this.root.add(this.plate, this.badge, this.word);
  }

  /** `reduced` = no flicker (reduced motion) */
  update(dt: number, reduced: boolean): void {
    this.t += dt;
    let lvl = 1;
    if (!reduced && this.t > this.next) {
      const u = this.t - this.next;
      if (u > 0.55) this.next = this.t + 5 + ((this.t * 7.13) % 6);
      else lvl = Math.sin(u * 61) > 0.15 ? 1 : 0.18;
    }
    this.level = lvl;
    this.word.material.color.setScalar(GLOW * lvl);
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const m of [this.badge, this.word]) {
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
    this.plate.geometry.dispose();
    this.plate.material.dispose();
  }
}
