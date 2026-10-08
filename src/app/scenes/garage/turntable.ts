import {
  CanvasTexture, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, TorusGeometry,
} from 'three';
import { PALETTE as P } from '../../../core/config/palette';
import { damp, smoothstep } from '../../../core/math2d';
import { toonify } from '../../../engine/env/toonify';

const RADIUS = 1.32;
const HEIGHT = 0.1;
/** seconds without input before the showroom spin creeps in, and its speed (rad/s) */
const IDLE_AFTER = 5;
const IDLE_SPIN = 0.16;
const LED = 1.8;

/** rubber top: concentric grooves and eight tick marks so the spin reads */
function topTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#2b2f3a';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(255,255,255,0.07)';
  g.lineWidth = 3;
  for (let r = 40; r < 250; r += 18) {
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = 'rgba(62,230,212,0.55)';
  g.lineWidth = 8;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(256 + Math.cos(a) * 222, 256 + Math.sin(a) * 222);
    g.lineTo(256 + Math.cos(a) * 246, 256 + Math.sin(a) * 246);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * The showroom turntable on the pavement: a low dark disc (grooved top, tick marks) with a gram-cyan LED edge that
 * flashes on equip. Owns the spin: `rotate(delta)` from the drag surface, an easy follow, and a slow showroom spin
 * after a few idle seconds (not with reduced motion).
 */
export class Turntable {
  readonly root = new Group();
  /** top surface height above the pavement */
  readonly top = HEIGHT;
  private readonly disc: Mesh<CylinderGeometry, MeshStandardMaterial[]>;
  private readonly led: Mesh<TorusGeometry, MeshBasicMaterial>;
  private readonly map = topTexture();
  private angle: number;
  private goal: number;
  private idle = 0;
  private flash = 0;

  constructor(heading: number) {
    this.root.name = 'turntable';
    this.angle = this.goal = heading;
    const side = toonify(new MeshStandardMaterial({ color: '#1d2029', roughness: 0.35, metalness: 0.55 }));
    const face = toonify(new MeshStandardMaterial({ color: '#ffffff', map: this.map, roughness: 0.8 }));
    this.disc = new Mesh(new CylinderGeometry(RADIUS, RADIUS + 0.05, HEIGHT, 72), [side, face, side]);
    this.disc.position.y = HEIGHT / 2;
    this.disc.castShadow = true;
    this.disc.receiveShadow = true;
    const glow = new MeshBasicMaterial({ color: P.gramCyan, toneMapped: false });
    this.led = new Mesh(new TorusGeometry(RADIUS + 0.012, 0.016, 8, 120), glow);
    this.led.rotation.x = Math.PI / 2;
    this.led.position.y = HEIGHT - 0.012;
    this.root.add(this.disc, this.led);
  }

  /** world heading of whatever stands on the disc */
  get heading(): number {
    return this.angle;
  }

  /** drag delta in radians (+ = dragged right: the near edge follows the finger) */
  rotate(delta: number): void {
    this.goal += delta;
    this.idle = 0;
  }

  /** the equip flash */
  pulse(): void {
    this.flash = 1;
  }

  update(dt: number, reduced: boolean): void {
    this.idle += dt;
    if (!reduced) this.goal += dt * IDLE_SPIN * smoothstep(IDLE_AFTER, IDLE_AFTER + 3, this.idle);
    this.angle += (this.goal - this.angle) * damp(14, dt);
    this.disc.rotation.y = this.angle;
    this.flash = Math.max(0, this.flash - dt * 1.8);
    this.led.material.color.set(P.gramCyan).multiplyScalar(LED + this.flash * this.flash * 5);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.disc.geometry.dispose();
    for (const m of new Set(this.disc.material)) m.dispose();
    this.map.dispose();
    this.led.geometry.dispose();
    this.led.material.dispose();
  }
}
