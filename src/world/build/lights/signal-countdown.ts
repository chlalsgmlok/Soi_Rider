import { CanvasTexture, LinearFilter, type Matrix4, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { MeshBuilder } from '../kit/mesh-builder';
import { emitPart } from '../signs/sign-geometry';
import type { TemplateLibrary } from '../templates/template-library';
import type { HeadState } from './signal-lights';

const SLOT_W = 64;
const SLOT_H = 32;
const COLS = 4;
const INK: Record<string, string> = { red: '#ff3b2f', amber: '#ffb21e', green: '#38ff7c' };

/**
 * The red / green seconds countdown under every Bangkok signal head: one small CanvasTexture (a slot per head,
 * redrawn only when its number or colour changes) on the heads' `countdown` quads, merged into one mesh.
 */
export class SignalCountdown {
  readonly mesh: Mesh | null = null;
  private readonly g: CanvasRenderingContext2D | null = null;
  private readonly texture: CanvasTexture | null = null;
  private readonly material: MeshBasicMaterial | null = null;
  private readonly shown: string[] = [];

  constructor(matrices: readonly Matrix4[], templates: TemplateLibrary) {
    const part = matrices.length ? templates.get('prop_traffic_light').signs.find((s) => s.node === 'countdown') : undefined;
    if (!part) return;
    const rows = Math.ceil(matrices.length / COLS);
    const canvas = document.createElement('canvas');
    canvas.width = SLOT_W * COLS;
    canvas.height = 2 ** Math.ceil(Math.log2(Math.max(2, rows) * SLOT_H));
    this.g = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.g.fillStyle = '#050506';
    this.g.fillRect(0, 0, canvas.width, canvas.height);
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    const mb = new MeshBuilder();
    matrices.forEach((m, k) => {
      const [x, y] = this.slot(k);
      const W = canvas.width;
      const H = canvas.height;
      emitPart(mb, part, m, [x / W, 1 - (y + SLOT_H) / H, (x + SLOT_W) / W, 1 - y / H], '#ffffff', 0);
      this.shown.push('');
    });
    this.material = new MeshBasicMaterial({ map: this.texture });
    this.material.color.setScalar(2.4);
    this.mesh = new Mesh(mb.toGeometry('decal'), this.material);
    this.mesh.name = 'signal_countdowns';
  }

  update(states: readonly HeadState[]): void {
    const g = this.g;
    if (!g || !this.texture) return;
    let dirty = false;
    states.forEach((s, k) => {
      const lit = s.aspect !== 'dark' && s.seconds >= 0 && s.seconds < 100;
      const label = lit ? `${s.aspect}:${s.seconds}` : 'off';
      if (label === this.shown[k]) return;
      this.shown[k] = label;
      const [x, y] = this.slot(k);
      g.fillStyle = '#050506';
      g.fillRect(x, y, SLOT_W, SLOT_H);
      if (lit) {
        g.fillStyle = INK[s.aspect] ?? '#ffffff';
        g.font = `700 ${SLOT_H * 0.9}px "Consolas", "Courier New", monospace`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(s.seconds).padStart(2, '0'), x + SLOT_W / 2, y + SLOT_H * 0.55);
      }
      dirty = true;
    });
    if (dirty) this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.mesh?.geometry.dispose();
    this.material?.dispose();
    this.texture?.dispose();
    this.mesh?.removeFromParent();
  }

  private slot(k: number): [number, number] {
    return [(k % COLS) * SLOT_W, Math.floor(k / COLS) * SLOT_H];
  }
}
