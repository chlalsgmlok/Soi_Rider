import { COMFORT, TRAITS } from '../core/config/scoring';
import { smoothstep } from '../core/math2d';
import type { PassengerTrait, SeatPerk } from '../core/types';
import {
  COMFORT_EVENT_DELTA, COMFORT_REASON, COMFORT_TUNING, JOLT_EVENTS, SCARE_EVENTS,
  type ComfortCause, type ComfortDelta, type ComfortEvent, type ComfortTickInput,
} from './comfort-tuning';
import { finiteOr } from './finite';

/**
 * Passenger comfort 0..100 (docs/GAME_DESIGN.md §8). Discrete events (`event`) apply at once; continuous effects
 * (`tick`) accumulate and are reported once per REPORT_INTERVAL so the HUD can show one "역주행 −0.8" chip per second
 * instead of sixty tiny ones. Reaching 0 sets `failed` (the passenger gets off) and freezes the model.
 * Types and tuning live in comfort-tuning.ts.
 */
const NONE: readonly ComfortDelta[] = Object.freeze([]);

export class ComfortModel {
  value: number;
  failed = false;
  private calm = 0;
  private braking = false;
  private sinceImpact = Infinity;
  /** seconds of continuous stopped-in-the-sun exposure */
  private hotFor = 0;
  private sinceReport = 0;
  private readonly pending = new Map<ComfortCause, number>();

  /** pillion seat gear perk (cushion / backrest / throne): softer jolts, faster recovery */
  constructor(readonly trait: PassengerTrait, start: number = COMFORT.start, private readonly perk: SeatPerk | null = null) {
    this.value = Math.min(100, Math.max(0, finiteOr(start, COMFORT.start)));
  }

  /** discrete change; null when nothing changed (already failed or clamped at 100) */
  event(kind: ComfortEvent): ComfortDelta | null {
    if (this.failed) return null;
    const t = TRAITS[this.trait];
    const jolt = this.perk && JOLT_EVENTS.has(kind) ? this.perk.jolt : 1;
    const delta = COMFORT_EVENT_DELTA[kind] * (SCARE_EVENTS.has(kind) ? t.scareMult : 1) * jolt;
    if (delta < 0) this.calm = 0;
    if (kind === 'body' || kind === 'fall') this.sinceImpact = 0;
    return this.apply(kind, delta);
  }

  /** advances continuous effects; returns harsh-brake events and, once per second, the accumulated per-cause deltas */
  tick(dt: number, s: ComfortTickInput): readonly ComfortDelta[] {
    if (this.failed || !(dt > 0) || !Number.isFinite(dt)) return NONE;
    let out: ComfortDelta[] | null = null;
    this.sinceImpact += dt;

    if (s.accel < -COMFORT.harshBrakeAccel && !this.braking) {
      this.braking = true;
      if (this.sinceImpact > COMFORT_TUNING.impactGrace) {
        const d = this.event('harshBrake');
        if (d) out = [d];
      }
    } else if (s.accel > COMFORT_TUNING.harshRearm) this.braking = false;

    const t = TRAITS[this.trait];
    const lateral = Math.abs(s.lateralAccel ?? 0);
    let drain = 0;
    drain += this.continuous('counterflow', s.counterflow, COMFORT.counterflowPerSec * dt);
    drain += this.continuous('sidewalk', s.sidewalk, COMFORT.sidewalkPerSec * dt);
    drain += this.continuous('rain', s.rainingNoPoncho, COMFORT.rainPerSec * dt);
    drain += this.continuous('smog', s.smogNoMask, COMFORT.smogPerSec * dt);
    const hot = s.heatStoppedUnshaded && Math.abs(s.speed) < COMFORT_TUNING.heatStopSpeed;
    this.hotFor = hot ? this.hotFor + dt : 0;
    drain += this.continuous('heat', this.hotFor > COMFORT_TUNING.heatGrace, COMFORT.heatPerSec * dt);
    drain += this.continuous('sharpTurn', lateral > COMFORT_TUNING.sharpTurnAccel,
      COMFORT_TUNING.sharpTurnPerSec * t.turnMult * dt);

    const steady = Math.abs(s.accel) <= COMFORT_TUNING.smoothMaxAccel && lateral <= COMFORT_TUNING.smoothMaxLateral;
    /* baking in the sun is never "smooth", even during the grace period before it starts to hurt */
    if (drain < 0 || !steady || hot) this.calm = 0;
    else this.calm += dt;
    if (drain === 0 && this.value < 100) {
      const rate = COMFORT.smoothPerSec * (this.perk?.recovery ?? 1) *
        smoothstep(COMFORT_TUNING.calmDelay, COMFORT_TUNING.calmFull, this.calm);
      if (rate > 0) this.accumulate('smooth', Math.min(rate * dt, 100 - this.value));
    }

    this.sinceReport += dt;
    if (this.failed || this.sinceReport >= COMFORT_TUNING.reportInterval) {
      const flushed = this.flush();
      if (flushed.length > 0) out = out ? out.concat(flushed) : flushed;
    }
    return out ?? NONE;
  }

  /** reports and clears the accumulated continuous deltas */
  flush(): ComfortDelta[] {
    this.sinceReport = 0;
    const out: ComfortDelta[] = [];
    for (const [cause, delta] of this.pending) {
      if (Math.abs(delta) >= 0.01) out.push({ cause, delta, reason: COMFORT_REASON[cause], value: this.value });
    }
    this.pending.clear();
    return out;
  }

  private continuous(cause: ComfortCause, active: boolean, delta: number): number {
    if (!active || this.failed) return 0;
    this.accumulate(cause, delta);
    return delta;
  }

  private accumulate(cause: ComfortCause, delta: number): void {
    const applied = this.change(delta);
    this.pending.set(cause, (this.pending.get(cause) ?? 0) + applied);
  }

  private apply(cause: ComfortCause, delta: number): ComfortDelta | null {
    const applied = this.change(delta);
    if (applied === 0) return null;
    return { cause, delta: applied, reason: COMFORT_REASON[cause], value: this.value };
  }

  /** clamps into 0..100, flags failure at 0, returns the change actually applied */
  private change(delta: number): number {
    if (!Number.isFinite(delta)) return 0;
    const before = this.value;
    this.value = Math.min(100, Math.max(0, before + delta));
    if (this.value <= 0) {
      this.value = 0;
      this.failed = true;
    }
    return this.value - before;
  }
}
