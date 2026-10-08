import type { CityData, Placement, Vec2 } from '../../core/types';
import { PALETTE } from '../../core/config/palette';

/** Overlay helpers for the top-down city map: placement colours, lane arrows, POI pins + labels. */

export function placementColor(p: Placement): string {
  const a = p.asset;
  if (a.startsWith('bld_')) return '#8a4b33';
  if (a.startsWith('bts_')) return '#8A5BFF';
  if (/raintree|palm|banana|bougainvillea|pot_plant/.test(a)) return a.includes('bougainvillea') ? PALETTE.bougainvillea : PALETTE.leafDark;
  if (a.includes('power_pole')) return '#222';
  if (a.includes('street_lamp')) return PALETTE.neonYellow;
  if (a.includes('traffic_light')) return PALETTE.neonRed;
  if (a.includes('soi_sign')) return PALETTE.signBlue;
  if (/food_cart|stool|table|umbrella|ice_box|crates/.test(a)) return PALETTE.taxiOrange;
  if (a.includes('win_stand')) return PALETTE.gramCyan;
  if (a.includes('spirit_house')) return PALETTE.sun;
  return '#ddd';
}

export function arrow(ctx: CanvasRenderingContext2D, o: Vec2, d: Vec2, s: number, size: number): void {
  const tip = { x: o.x + d.x * (s + size), z: o.z + d.z * (s + size) };
  const l = { x: d.z, z: -d.x };
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.z);
  ctx.lineTo(o.x + d.x * s + l.x * size * 0.6, o.z + d.z * s + l.z * size * 0.6);
  ctx.lineTo(o.x + d.x * s - l.x * size * 0.6, o.z + d.z * s - l.z * size * 0.6);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

export function drawPois(ctx: CanvasRenderingContext2D, data: CityData, toScreen: (p: Vec2) => Vec2): void {
  ctx.font = '600 12px "Malgun Gothic", "Pretendard", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const p of data.pois) {
    const s = toScreen(p.pos);
    const spawn = p.id === data.spawn.poi;
    ctx.fillStyle = spawn ? PALETTE.gramCyan : p.landmark ? PALETTE.sun : PALETTE.pinCoral;
    ctx.beginPath();
    ctx.arc(s.x, s.z, spawn ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const label = `${p.name}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(label, s.x + 8, s.z);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, s.x + 8, s.z);
  }
  const sp = toScreen(data.spawn.pos);
  const f = { x: Math.sin(data.spawn.heading), z: Math.cos(data.spawn.heading) };
  ctx.strokeStyle = PALETTE.gramCyan;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sp.x, sp.z);
  ctx.lineTo(sp.x + f.x * 22, sp.z + f.z * 22);
  ctx.stroke();
}
