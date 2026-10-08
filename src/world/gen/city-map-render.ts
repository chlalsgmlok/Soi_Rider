import type { CityData, TurnKind, Vec2 } from '../../core/types';
import { FOOTPRINTS } from './asset-footprints';
import { arrow, drawPois, placementColor } from './city-map-overlays';
import { Surface } from '../../core/types';
import { PALETTE } from '../../core/config/palette';
import type { SurfaceMap } from '../surface-map';

/**
 * Top-down 2D renderer of CityData (dev sandbox + a base for the gram mini-map). World x → canvas x,
 * world z → canvas y, so the picture is the city seen from above, unmirrored.
 */
export interface MapView {
  cx: number;
  cz: number;
  /** pixels per metre */
  scale: number;
  width: number;
  height: number;
}

export interface MapLayers {
  lanes: boolean;
  connectors: boolean;
  placements: boolean;
  colliders: boolean;
  pois: boolean;
}

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

export const SURFACE_COLORS: Record<number, [number, number, number]> = {
  [Surface.Void]: hex('#3E5240'),
  [Surface.Road]: hex(PALETTE.asphalt),
  [Surface.Sidewalk]: hex(PALETTE.sidewalk),
  [Surface.Median]: hex('#7FAE5A'),
  [Surface.Building]: hex('#C98F6E'),
  [Surface.Plaza]: hex('#E3D7BC'),
  [Surface.Crosswalk]: hex(PALETTE.laneWhite),
  [Surface.Intersection]: hex('#5E5753'),
};

const TURN_COLORS: Record<TurnKind, string> = {
  straight: 'rgba(255,255,255,0.35)', left: 'rgba(80,220,120,0.7)', right: 'rgba(255,160,60,0.7)', uturn: 'rgba(255,80,200,0.85)',
};

/** one pixel per raster cell; draw scaled with smoothing off */
export function surfaceImage(map: SurfaceMap): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = map.cols;
  cv.height = map.rows;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const img = g.createImageData(map.cols, map.rows);
  for (let i = 0; i < map.data.length; i++) {
    const c = SURFACE_COLORS[map.data[i]] ?? [255, 0, 255];
    img.data[i * 4] = c[0];
    img.data[i * 4 + 1] = c[1];
    img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

export function drawCityMap(ctx: CanvasRenderingContext2D, data: CityData, surface: HTMLCanvasElement, map: SurfaceMap, v: MapView, layers: MapLayers): void {
  const toScreen = (p: Vec2): Vec2 => ({ x: v.width / 2 + (p.x - v.cx) * v.scale, z: v.height / 2 + (p.z - v.cz) * v.scale });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#20251f';
  ctx.fillRect(0, 0, v.width, v.height);
  ctx.setTransform(v.scale, 0, 0, v.scale, v.width / 2 - v.cx * v.scale, v.height / 2 - v.cz * v.scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(surface, map.minX, map.minZ, map.cols * map.cell, map.rows * map.cell);
  const px = 1 / v.scale;
  ctx.lineCap = 'round';
  for (const e of data.edges) {
    if (!e.skytrain) continue;
    const a = data.nodes[e.a].pos;
    const b = data.nodes[e.b].pos;
    ctx.strokeStyle = 'rgba(138,91,255,0.28)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(a.x, a.z);
    ctx.lineTo(b.x, b.z);
    ctx.stroke();
  }
  if (layers.connectors) {
    ctx.lineWidth = 1.2 * px;
    for (const c of data.connectors) {
      ctx.strokeStyle = TURN_COLORS[c.turn];
      ctx.beginPath();
      c.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)));
      ctx.stroke();
    }
  }
  if (layers.lanes) {
    for (const ln of data.lanes) {
      const e = data.edges[ln.edge];
      ctx.strokeStyle = e.oneWay ? 'rgba(62,230,212,0.9)' : ln.forward ? 'rgba(255,240,200,0.8)' : 'rgba(255,200,120,0.8)';
      ctx.lineWidth = 1.3 * px;
      ctx.beginPath();
      ctx.moveTo(ln.start.x, ln.start.z);
      ctx.lineTo(ln.end.x, ln.end.z);
      ctx.stroke();
      const step = Math.max(10, 60 * px);
      for (let s = step / 2; s < ln.length; s += step) arrow(ctx, ln.start, ln.dir, s, Math.max(1.6, 7 * px));
    }
  }
  if (layers.placements) {
    for (const p of data.placements) {
      if (p.asset === 'bts_deck' || p.asset === 'bts_station' || (p.asset.startsWith('bld_') && !p.meta?.skyline)) continue;
      if (p.asset === 'bts_pillar') {
        ctx.save();
        ctx.translate(p.pos.x, p.pos.z);
        ctx.rotate(-p.heading);
        ctx.fillStyle = '#8A5BFF';
        ctx.fillRect(-1.1, -1.8, 2.2, 3.6);
        ctx.restore();
        continue;
      }
      ctx.fillStyle = placementColor(p);
      const fp = FOOTPRINTS[p.asset];
      const keep = fp ? (typeof fp.keep === 'number' ? fp.keep : Math.max(fp.keep[0], fp.keep[1]) / 2) : 6;
      const r = Math.max(keep * p.scale * 0.8, 1.6 * px);
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.z, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (layers.colliders) {
    ctx.strokeStyle = 'rgba(255,40,40,0.9)';
    ctx.lineWidth = 1 * px;
    for (const c of data.colliders) {
      if (c.circle) {
        ctx.beginPath();
        ctx.arc(c.circle.cx, c.circle.cz, c.circle.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (c.obb) {
        const o = c.obb;
        ctx.save();
        ctx.translate(o.cx, o.cz);
        ctx.rotate(-o.angle);
        ctx.strokeRect(-o.hw, -o.hl, o.hw * 2, o.hl * 2);
        ctx.restore();
      }
    }
  }
  for (const n of data.nodes) {
    if (!n.signal) continue;
    ctx.strokeStyle = PALETTE.pinCoral;
    ctx.lineWidth = 2.5 * px;
    ctx.beginPath();
    ctx.arc(n.pos.x, n.pos.z, n.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (layers.pois) drawPois(ctx, data, toScreen);
}
