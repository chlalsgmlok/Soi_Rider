import type { Vec2 } from '../../core/types';
import { type PedCtx, WALK } from './ped-ctx';
import type { Pedestrian } from './pedestrian';
import { stripPoint } from './sidewalk-net';

const cand: number[] = [];
/** give up waiting at a kerb after this long (s) */
const GIVE_UP = 28;

/**
 * Is the road between kerb points a and b safe to step onto? Nothing may be on the crossing line now and no
 * moving vehicle (or the rider) may reach it within `horizon` seconds.
 */
export function roadClear(a: Vec2, b: Vec2, horizon: number, ctx: PedCtx): boolean {
  const cx = (a.x + b.x) / 2;
  const cz = (a.z + b.z) / 2;
  const half = Math.hypot(b.x - a.x, b.z - a.z) / 2;
  const ux = (b.x - a.x) / (2 * half || 1);
  const uz = (b.z - a.z) / (2 * half || 1);
  const reach = half + 36;
  const n = ctx.obstacles.query(cx - reach, cz - reach, cx + reach, cz + reach, cand);
  for (let k = 0; k < n; k++) {
    const o = ctx.obstacles.items[cand[k]];
    if (o.kind === 'pedestrian') continue;
    const rx = o.x - cx;
    const rz = o.z - cz;
    const along = rx * ux + rz * uz;
    const across = rx * uz - rz * ux;
    const ext = Math.max(o.hw, o.hl);
    if (Math.abs(along) < half + ext + 0.5 && Math.abs(across) < ext + 1.2) return false;
    if (o.speed < 0.6) continue;
    const fx = Math.sin(o.h);
    const fz = Math.cos(o.h);
    const closing = -(fx * uz - fz * ux) * Math.sign(across);
    if (closing <= 0.2) continue;
    const t = (Math.abs(across) - o.hl - 1) / (o.speed * closing);
    const hitAlong = along + fx * ux * o.speed * t + fz * uz * o.speed * t;
    if (t < horizon && Math.abs(hitAlong) < half + 3) return false;
  }
  return true;
}

/** start waiting at the kerb to cross along `crossing` (signal / informal) or to jaywalk at the current s */
export function approachKerb(p: Pedestrian, ctx: PedCtx, crossingId: number, jaywalk: boolean): void {
  p.mode = 'wait';
  p.crossingId = crossingId;
  p.jaywalk = jaywalk;
  p.wait = 0;
  const st = ctx.net.strips[p.strip];
  p.offTarget = -st.width / 2 + 0.25;
}

/** waiting at the kerb: step out once the walk phase / a traffic gap allows it, give up when it takes too long */
export function waitAtKerb(p: Pedestrian, ctx: PedCtx): void {
  p.wait += ctx.dt;
  p.speed = 0;
  const st = ctx.net.strips[p.strip];
  const e = st.frame.e;
  const pair = ctx.net.byEdge[e.id];
  const other = pair[0] === p.strip ? pair[1] : pair[0];
  const c = p.crossingId >= 0 ? ctx.net.crossings[p.crossingId] : null;
  const s = c ? c.s : p.s;
  if (other < 0 || p.wait > GIVE_UP) {
    p.mode = 'walk';
    p.offTarget = p.habit;
    return;
  }
  const to = ctx.net.strips[other];
  const a = stripPoint(st, s, -st.width / 2 + 0.2);
  const b = stripPoint(to, s, -to.width / 2 + 0.2);
  const width = Math.hypot(b.x - a.x, b.z - a.z);
  const speed = p.jaywalk ? WALK.jaywalk : c && c.node >= 0 ? WALK.crossSignal : WALK.crossInformal;
  let go: boolean;
  if (c && c.node >= 0) {
    const walk = ctx.signals.controller(c.node)?.walkLeft(e.id) ?? 0;
    go = walk > width / speed + 1 && roadClear(a, b, 1.2, ctx);
  } else {
    const patience = Math.max(0.55, 1 - p.wait / 30);
    go = roadClear(a, b, (width / speed + 2.5) * patience, ctx);
  }
  if (!go) return;
  const end = stripPoint(to, s, 0);
  p.beginPath([{ x: p.pos.x, z: p.pos.z }, a, b, end], other, s, p.dir, true);
  p.cruise = Math.max(p.cruise, speed);
}
