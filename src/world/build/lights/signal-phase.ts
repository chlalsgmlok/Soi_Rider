import type { SignalPhase, Vec2 } from '../../../core/types';

export type SignalAspect = 'red' | 'amber' | 'green';
export type SignalAxis = 'ns' | 'ew';

/**
 * Convention shared with src/traffic: an approach belongs to the 'ns' phase group when its road runs mostly along
 * world Z (|dir.z| ≥ |dir.x|), else to 'ew'. `dir` = any direction along the approach road.
 */
export function approachAxis(dir: Vec2): SignalAxis {
  return Math.abs(dir.z) >= Math.abs(dir.x) ? 'ns' : 'ew';
}

/** lamp shown to an approach of axis `axis` during `phase` */
export function signalAspect(phase: SignalPhase, axis: SignalAxis): SignalAspect {
  switch (phase) {
    case 'ns_green':
      return axis === 'ns' ? 'green' : 'red';
    case 'ns_yellow':
      return axis === 'ns' ? 'amber' : 'red';
    case 'ew_green':
      return axis === 'ew' ? 'green' : 'red';
    case 'ew_yellow':
      return axis === 'ew' ? 'amber' : 'red';
    default:
      return 'red';
  }
}

/** typical amber + all-red time (s) added to a red approach's countdown while the cross street still has green */
export const CLEARANCE_GUESS = 5;

/**
 * Seconds shown on an approach's countdown: green / amber show the phase remainder; red shows the remainder of the
 * crossing green plus the clearance that follows it (the exact cycle lives in src/traffic).
 */
export function countdownSeconds(phase: SignalPhase, axis: SignalAxis, remaining: number): number {
  const aspect = signalAspect(phase, axis);
  if (aspect !== 'red') return Math.max(0, Math.ceil(remaining));
  const crossGreen = phase === 'ns_green' || phase === 'ew_green';
  return Math.max(0, Math.ceil(remaining + (crossGreen ? CLEARANCE_GUESS : 0)));
}
