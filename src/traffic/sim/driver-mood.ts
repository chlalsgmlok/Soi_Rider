import type { DriveCtx } from './drive-ctx';
import type { LongPlan } from './longitudinal';
import type { Vehicle } from './vehicle';

/** honking starts after being blocked this long (s) */
export const HONK_AFTER = 2.5;
const EXHAUST_KINDS = new Set(['bus', 'songthaew', 'tuktuk']);

function honk(v: Vehicle, ctx: DriveCtx): void {
  const r = ctx.rng;
  v.honkLeft = v.kind === 'tuktuk' || v.isMoto ? r.range(0.18, 0.4) : v.kind === 'bus' ? r.range(0.6, 1.2) : r.range(0.3, 0.8);
  v.honkCooldown = r.range(2.6, 5.5);
  ctx.bus?.emit('horn', { by: 'npc', pos: { x: v.pos.x, z: v.pos.z }, kind: v.kind });
}

/**
 * Per-step bookkeeping that is not motion: brake lights, queue flag, junction wait, "stuck" time for the deadlock
 * breaker, horn when blocked by the rider / a pedestrian / a car that will not move on green, start-up reaction
 * delay after a stop (makes stop-and-go waves) and bus exhaust puffs.
 */
export function updateMood(v: Vehicle, plan: LongPlan, ctx: DriveCtx): void {
  const dt = ctx.dt;
  const heldByLight = plan.lamp !== 'green' && plan.distLine < 30;
  v.heldByLight = heldByLight;
  v.atGate = plan.atGate;
  if (v.speed < 0.3 && !heldByLight) v.stuck += dt;
  else if (v.speed > 1) v.stuck = 0;
  if (plan.atGate && v.speed < 0.6) v.wait += dt;
  else if (!plan.atGate) v.wait = 0;

  const annoying = v.leader === 'player' || v.leader === 'pedestrian' ||
    (v.leader === 'vehicle' && !heldByLight && v.stuck > 5) || (plan.atGate && v.wait > 9);
  if (v.speed < 0.6 && annoying) v.blocked += dt;
  else v.blocked = Math.max(0, v.blocked - dt * 2);
  v.honkCooldown -= dt;
  v.honkLeft -= dt;
  if (v.blocked > HONK_AFTER && v.honkCooldown <= 0) honk(v, ctx);
  v.honking = v.honkLeft > 0;

  v.braking = v.accel < -0.6 || v.speed < 0.4;
  v.queued = v.speed < 0.8 && (v.leader === 'vehicle' || v.leader === 'stop');

  if (v.speed < 0.05) {
    if (!v.wasStopped) {
      v.wasStopped = true;
      v.startDelay = ctx.rng.range(0.35, ctx.flow < 0.5 ? 1.5 : 0.9) * (v.isMoto ? 0.5 : 1);
    }
  } else if (v.speed > 0.5) v.wasStopped = false;

  v.exhaustCooldown -= dt;
  if (ctx.onExhaust && EXHAUST_KINDS.has(v.kind) && v.accel > 0.45 && v.speed < 6 && v.exhaustCooldown <= 0) {
    v.exhaustCooldown = v.kind === 'bus' ? 0.45 : 0.8;
    const back = v.halfLen - 0.2;
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    // tailpipe: rear, slightly to the right (right = (−fz, fx))
    ctx.onExhaust({
      pos: { x: v.pos.x - fx * back - fz * 0.5, z: v.pos.z - fz * back + fx * 0.5 },
      heading: v.heading + Math.PI, strength: Math.min(1, 0.35 + v.accel / 1.5), kind: v.kind,
    });
  }
}

/** hold acceleration during the start-up reaction time after a standstill */
export function reactionHold(v: Vehicle, accel: number, dt: number): number {
  if (accel <= 0 || !v.wasStopped || v.startDelay <= 0) return accel;
  v.startDelay -= dt;
  return 0;
}
