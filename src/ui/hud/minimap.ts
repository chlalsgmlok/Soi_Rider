/**
 * Heading-up mini-map canvas for the gram phone. Roads come from a MapSource (cached per 120 m of travel),
 * route + target from HudState.minimap. Redraws at most ~15 Hz and only when something moved.
 * World → screen is a single canvas transform, so road widths are drawn in metres.
 */
import type { MinimapState } from '../../core/types/hud';
import type { Vec2 } from '../../core/types/geometry';
import type { MapRoad, MapSource } from './types';
import { h } from '../core/h';
import { drawPin, drawPlayer } from './minimap-glyphs';

const QUERY_R = 320;
const REQUERY_DIST = 120;
const FRAME_MS = 66;

const THEME = {
  day: { bg: '#efe4cf', block: 'rgba(214,196,164,.35)', casing: '#d5c19d', road: '#ffffff', main: '#fff1c4', route: '#3EE6D4', routeCase: '#0a6e65' },
  night: { bg: '#1d2232', block: 'rgba(60,68,92,.35)', casing: '#121521', road: '#3b4460', main: '#55607e', route: '#3EE6D4', routeCase: '#06403b' },
} as const;

export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private source: MapSource | null = null;
  private roads: readonly MapRoad[] = [];
  private cacheAt: Vec2 | null = null;
  private night = false;
  private lastDraw = 0;
  private lastKey = '';
  private heading = 0;
  private w = 0;
  private hgt = 0;
  private dpr = 1;
  private measured = false;
  private ro: ResizeObserver;

  constructor() {
    this.canvas = h('canvas.hud-phone__map', { aria: { label: '미니맵' }, role: 'img' });
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable for the mini-map');
    this.ctx = ctx;
    this.ro = new ResizeObserver(() => {
      this.measured = false;
      this.lastKey = '';
    });
    this.ro.observe(this.canvas);
  }

  dispose(): void {
    this.ro.disconnect();
  }

  setSource(fn: MapSource | null): void {
    this.source = fn;
    this.cacheAt = null;
    this.roads = [];
    this.lastKey = '';
  }

  setNight(on: boolean): void {
    this.night = on;
    this.lastKey = '';
  }

  /** measures only after a ResizeObserver notification (no per-frame layout reads) */
  private resize(): boolean {
    if (this.measured) return true;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width);
    const hh = Math.round(r.height);
    if (!w || !hh) return false;
    if (w !== this.w || hh !== this.hgt || dpr !== this.dpr) {
      this.w = w;
      this.hgt = hh;
      this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hh * dpr);
      this.lastKey = '';
    }
    this.measured = true;
    return true;
  }

  update(m: MinimapState, speedKmh: number, now: number): void {
    if (now - this.lastDraw < FRAME_MS) return;
    // smooth heading so the map never jitters
    let dh = m.playerHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * 0.35;
    const key = `${m.playerPos.x.toFixed(1)}|${m.playerPos.z.toFixed(1)}|${this.heading.toFixed(3)}|${m.route.length}|${m.target?.x ?? ''}`;
    if (key === this.lastKey) return;
    if (!this.resize()) return;
    this.lastKey = key;
    this.lastDraw = now;
    this.refreshRoads(m.playerPos);
    this.draw(m, speedKmh);
  }

  private refreshRoads(p: Vec2): void {
    if (!this.source) return;
    if (this.cacheAt && Math.hypot(p.x - this.cacheAt.x, p.z - this.cacheAt.z) < REQUERY_DIST) return;
    this.cacheAt = { x: p.x, z: p.z };
    this.roads = this.source(this.cacheAt, QUERY_R);
  }

  private draw(m: MinimapState, speedKmh: number): void {
    const { ctx, w, hgt: ht, dpr } = this;
    const t = this.night ? THEME.night : THEME.day;
    const scale = 1.25 - Math.min(1, Math.abs(speedKmh) / 60) * 0.45; // px per metre, zooms out with speed
    const cx = w / 2;
    const cy = ht * 0.66;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = -Math.cos(this.heading);
    const rz = Math.sin(this.heading);
    const a = scale * rx;
    const c = scale * rz;
    const b = -scale * fx;
    const d = -scale * fz;
    const px = m.playerPos.x;
    const pz = m.playerPos.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, w, ht);
    ctx.setTransform(dpr * a, dpr * b, dpr * c, dpr * d, dpr * (cx - a * px - c * pz), dpr * (cy - b * px - d * pz));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pass of [0, 1] as const) {
      for (const r of this.roads) {
        ctx.strokeStyle = pass === 0 ? t.casing : r.cls === 'main' ? t.main : t.road;
        ctx.lineWidth = r.width + (pass === 0 ? 3 / scale : 0);
        ctx.beginPath();
        ctx.moveTo(r.a.x, r.a.z);
        ctx.lineTo(r.b.x, r.b.z);
        ctx.stroke();
      }
    }
    if (m.route.length > 1) {
      for (const [color, px2] of [[t.routeCase, 7], [t.route, 4]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = px2 / scale;
        ctx.beginPath();
        ctx.moveTo(px, pz);
        for (const p of m.route) ctx.lineTo(p.x, p.z);
        ctx.stroke();
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (m.target) {
      const tx = cx + a * (m.target.x - px) + c * (m.target.z - pz);
      const ty = cy + b * (m.target.x - px) + d * (m.target.z - pz);
      drawPin(this.ctx, Math.min(w - 10, Math.max(10, tx)), Math.min(ht - 4, Math.max(18, ty)));
    }
    drawPlayer(this.ctx, cx, cy);
  }
}
