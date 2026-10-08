/** AudioParam automation gestures shared by every synth. All times are AudioContext seconds. */

/** Linear attack to `peak`, then an exponential fall that is ~−40 dB after `decay` seconds. Returns the end time. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0, t + attack, Math.max(0.002, decay / 4.6));
  return t + attack + decay;
}

/** attack → hold `peak` → linear release. Returns the end time. */
export function gate(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setValueAtTime(peak, t + attack + hold);
  p.linearRampToValueAtTime(0, t + attack + hold + release);
  return t + attack + hold + release;
}

/** Swell up over `rise`, then fall exponentially over `fall` (pass-bys, gusts). Returns the end time. */
export function swell(p: AudioParam, t: number, peak: number, rise: number, fall: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak * 0.35, t + rise * 0.6);
  p.linearRampToValueAtTime(peak, t + rise);
  p.setTargetAtTime(0, t + rise, Math.max(0.002, fall / 4.6));
  return t + rise + fall;
}

/** Exponential glide between two positive values (pitch drops, filter sweeps). */
export function sweep(p: AudioParam, t: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(Math.max(1e-4, from), t);
  p.exponentialRampToValueAtTime(Math.max(1e-4, to), t + Math.max(0.001, dur));
}

/** Smoothly chase a target; safe for per-frame calls and ignores non-finite values. */
export function chase(p: AudioParam, value: number, t: number, timeConstant: number): void {
  if (!Number.isFinite(value) || !Number.isFinite(t)) return;
  p.setTargetAtTime(value, t, Math.max(0.001, timeConstant));
}

/** Drop automation scheduled from `t` on, keeping the value an in-flight ramp has at `t` (no click). */
export function hold(p: AudioParam, t: number): void {
  // Firefox lacks cancelAndHoldAtTime → plain cancel (may step on an unfinished linear ramp)
  if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(t);
  else p.cancelScheduledValues(t);
}

/** Drop pending automation from `t` on and continue smoothly towards `value`. */
export function retarget(p: AudioParam, value: number, t: number, timeConstant: number): void {
  if (!Number.isFinite(value)) return;
  hold(p, t);
  p.setTargetAtTime(value, t, Math.max(0.001, timeConstant));
}
