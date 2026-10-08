import type { SignalPhase } from '../../core/types';

/** amber time after every green (s) */
export const YELLOW_SEC = 3;
/** all-red clearance after every amber (s) */
export const ALL_RED_SEC = 2;
/** shortest green any approach gets (s) */
export const MIN_GREEN_SEC = 6;

export type LampState = 'green' | 'yellow' | 'red';

/** Phase of a fixed-time plan at one instant. */
export interface PhaseState {
  /** approach group whose stage is running (0 = "ns", 1 = "ew") */
  group: number;
  stage: LampState | 'all_red';
  /** seconds left in this stage */
  remaining: number;
  /** seconds left of this group's green (0 once amber started) */
  greenLeft: number;
}

/** green per group for a cycle length split evenly between `groups` approach groups */
export function greenTime(cycle: number, groups: number): number {
  return Math.max(MIN_GREEN_SEC, cycle / groups - YELLOW_SEC - ALL_RED_SEC);
}

/**
 * Fixed-time plan: group 0 green → amber → all-red → group 1 green → amber → all-red → … `t` is the junction's
 * local clock (global time + offset).
 */
export function phaseAt(t: number, cycle: number, groups: number, out: PhaseState): PhaseState {
  const g = greenTime(cycle, groups);
  const stage = g + YELLOW_SEC + ALL_RED_SEC;
  const total = stage * groups;
  const local = ((t % total) + total) % total;
  const idx = Math.min(groups - 1, Math.floor(local / stage));
  const within = local - idx * stage;
  out.group = idx;
  if (within < g) {
    out.stage = 'green';
    out.remaining = g - within;
    out.greenLeft = g - within;
  } else if (within < g + YELLOW_SEC) {
    out.stage = 'yellow';
    out.remaining = g + YELLOW_SEC - within;
    out.greenLeft = 0;
  } else {
    out.stage = 'all_red';
    out.remaining = stage - within;
    out.greenLeft = 0;
  }
  return out;
}

/** lamp shown to approaches of `group` */
export function lampFor(p: PhaseState, group: number): LampState {
  if (p.stage === 'all_red' || p.group !== group) return 'red';
  return p.stage;
}

/** contract name of a phase (group 0 = ns, group 1 = ew; further groups alternate) */
export function phaseName(p: PhaseState): SignalPhase {
  if (p.stage === 'all_red') return 'all_red';
  const ns = p.group % 2 === 0;
  if (p.stage === 'green') return ns ? 'ns_green' : 'ew_green';
  return ns ? 'ns_yellow' : 'ew_yellow';
}

/**
 * Lamp an approach of `group` sees for a published SignalPhase — for consumers that only hold a SignalView
 * (city view lamp heads, HUD). Group 0 ↔ ns, group 1 ↔ ew.
 */
export function lampForPhase(phase: SignalPhase, group: number): LampState {
  const ns = group % 2 === 0;
  if (phase === (ns ? 'ns_green' : 'ew_green')) return 'green';
  if (phase === (ns ? 'ns_yellow' : 'ew_yellow')) return 'yellow';
  return 'red';
}

/**
 * Pedestrian walk phase: people may start crossing an arm of `group` while that arm's traffic is held, i.e. while
 * another group has green. Returns the seconds of protected walking left (0 = don't walk / wait).
 */
export function walkTimeLeft(p: PhaseState, group: number): number {
  if (p.group === group) return 0;
  if (p.stage === 'green') return p.greenLeft + YELLOW_SEC;
  return p.stage === 'yellow' ? p.remaining * 0.5 : 0;
}
