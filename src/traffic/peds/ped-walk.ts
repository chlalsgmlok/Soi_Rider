import { damp } from '../../core/math2d';
import { chooseOffset } from './ped-avoid';
import { approachKerb, waitAtKerb } from './ped-cross';
import type { PedCtx } from './ped-ctx';
import type { Pedestrian } from './pedestrian';
import { stripPoint } from './sidewalk-net';

/** chance to use a crosswalk / informal crossing the walker passes */
const CROSS_CHANCE = 0.45;

/** at a strip end: walk round the corner onto a linked strip, or turn back */
function atStripEnd(p: Pedestrian, ctx: PedCtx): void {
  const st = ctx.net.strips[p.strip];
  const end = p.dir > 0 ? 1 : 0;
  const links = st.links[end];
  if (links.length === 0) {
    p.dir = p.dir > 0 ? -1 : 1;
    return;
  }
  const leader = p.follow >= 0 ? ctx.byId(p.follow) : undefined;
  const goal = leader ? (leader.mode === 'path' ? leader.nextStrip : leader.strip) : -1;
  const l = links.find((k) => k.to === goal) ?? ctx.rng.pick(links);
  const to = ctx.net.strips[l.to];
  const s = l.toEnd === 0 ? to.s0 : to.s1;
  p.beginPath(l.path, l.to, s, l.toEnd === 0 ? 1 : -1, false);
}

function walkStrip(p: Pedestrian, ctx: PedCtx): void {
  const st = ctx.net.strips[p.strip];
  const dt = ctx.dt;
  p.avoidTimer -= dt;
  if (p.avoidTimer <= 0) {
    p.avoidTimer = 0.35 + ctx.rng.next() * 0.2;
    p.offTarget = chooseOffset(p, ctx);
  }
  const before = p.s;
  let cruise = p.cruise;
  const leader = p.follow >= 0 ? ctx.byId(p.follow) : undefined;
  if (leader) {
    const d = Math.hypot(leader.pos.x - p.pos.x, leader.pos.z - p.pos.z);
    cruise *= d < 1.2 ? 0.4 : d > 2 ? 1.25 : 1;
  }
  p.speed += (cruise - p.speed) * damp(3, dt);
  p.s += p.dir * p.speed * dt;
  for (const id of st.crossings) {
    const c = ctx.net.crossings[id];
    if ((c.s - before) * p.dir > 0 && (c.s - p.s) * p.dir <= 0 && p.role === 'walker' && ctx.rng.chance(CROSS_CHANCE)) {
      p.s = c.s;
      approachKerb(p, ctx, id, false);
      return;
    }
  }
  p.thinkTimer -= dt;
  if (p.thinkTimer <= 0) {
    p.thinkTimer = ctx.rng.range(5, 10);
    const e = st.frame.e;
    const mid = p.s > st.s0 + 6 && p.s < st.s1 - 6;
    if (p.role === 'walker' && mid && e.median <= 0 && e.cls !== 'main' && ctx.rng.chance(ctx.jaywalkChance * 0.6)) {
      approachKerb(p, ctx, -1, true);
      return;
    }
  }
  if (p.s > st.s1 || p.s < st.s0) {
    p.s = Math.min(st.s1, Math.max(st.s0, p.s));
    atStripEnd(p, ctx);
  }
}

function followPath(p: Pedestrian, ctx: PedCtx): boolean {
  p.speed += (p.cruise - p.speed) * damp(4, ctx.dt);
  p.pathS += p.speed * ctx.dt;
  if (p.pathS >= p.pathLen) {
    p.mode = 'walk';
    p.crossing = false;
    p.crossingId = -1;
    p.jaywalk = false;
    p.strip = p.nextStrip;
    p.s = p.nextS;
    p.dir = p.nextDir;
    p.off = p.offTarget = p.habit;
    return false;
  }
  let d = p.pathS;
  for (let i = 1; i < p.path.length; i++) {
    const a = p.path[i - 1];
    const b = p.path[i];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= l || i === p.path.length - 1) {
      const t = l > 1e-6 ? Math.min(1, d / l) : 1;
      p.pos.x = a.x + (b.x - a.x) * t;
      p.pos.z = a.z + (b.z - a.z) * t;
      if (l > 1e-6) p.heading = Math.atan2(b.x - a.x, b.z - a.z);
      return true;
    }
    d -= l;
  }
  return true;
}

/**
 * One pedestrian step: walk along the strip (avoiding props and people), decide to cross at crosswalks / soi
 * mouths or to jaywalk, wait at the kerb, follow corner links and crossings; vendors just stand. The startle push
 * is applied on top by the caller.
 */
export function stepPedestrian(p: Pedestrian, ctx: PedCtx): void {
  if (p.mode === 'stand') {
    p.speed = 0;
    return;
  }
  if (p.mode === 'wait') waitAtKerb(p, ctx);
  else if (p.mode === 'walk') walkStrip(p, ctx);
  if (p.mode === 'path' && followPath(p, ctx)) {
    p.gait += p.speed * ctx.dt;
    return;
  }
  const st = ctx.net.strips[p.strip];
  p.off += Math.max(-0.9 * ctx.dt, Math.min(0.9 * ctx.dt, p.offTarget - p.off));
  const q = stripPoint(st, p.s, p.off);
  p.pos.x = q.x;
  p.pos.z = q.z;
  const e = st.frame.e;
  const h = Math.atan2(e.dir.x * p.dir, e.dir.z * p.dir);
  p.heading = p.mode === 'wait' ? h + st.frame.side * p.dir * -Math.PI / 2 * Math.min(1, p.wait * 2) : h;
  p.gait += p.speed * ctx.dt;
}
