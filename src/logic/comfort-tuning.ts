import { itemById } from '../core/config/catalog';
import { COMFORT } from '../core/config/scoring';
import type { GearId, HelmetId, SeatPerk } from '../core/types';

/** Inputs, outputs and tuning of the passenger comfort model (docs/GAME_DESIGN.md §7, §8). Logic: comfort.ts. */

export type ComfortEvent = 'nearMiss' | 'harshBrake' | 'mirror' | 'body' | 'fall' | 'raincoat' | 'mask';
export type ComfortCause = ComfortEvent | 'counterflow' | 'sidewalk' | 'rain' | 'smog' | 'heat' | 'sharpTurn' | 'smooth';

/** shape-compatible with GameEvents['comfort:delta'] plus the machine-readable cause */
export interface ComfortDelta {
  cause: ComfortCause;
  delta: number;
  reason: string;
  value: number;
}

export interface ComfortTickInput {
  /** m/s; the heat rule only counts while slower than COMFORT_TUNING.heatStopSpeed */
  speed: number;
  /** longitudinal acceleration m/s² (negative = braking); braking harder than 6 m/s² is a harsh brake */
  accel: number;
  /** |v · yawRate| m/s²; optional — enables the sharp-turn effect */
  lateralAccel?: number;
  counterflow: boolean;
  sidewalk: boolean;
  rainingNoPoncho: boolean;
  smogNoMask: boolean;
  /**
   * raw condition: midday heat, no shade (BTS deck, awning) and the bike stopped. The model itself waits
   * COMFORT_TUNING.heatGrace (5 s) of continuous exposure before the −0.3/s drain starts — do not delay it upstream.
   */
  heatStoppedUnshaded: boolean;
}

export const COMFORT_REASON: Record<ComfortCause, string> = {
  nearMiss: '아슬아슬한 틈',
  harshBrake: '급제동',
  mirror: '미러 접촉',
  body: '차량 충돌',
  fall: '넘어짐',
  raincoat: '우비 건넴',
  mask: '마스크 건넴',
  counterflow: '역주행',
  sidewalk: '인도 주행',
  rain: '비 맞는 중',
  smog: '매연',
  heat: '땡볕 정차',
  sharpTurn: '급회전',
  smooth: '부드러운 주행',
};

export const COMFORT_TUNING = {
  /** seconds without any upset before recovery starts, and until it reaches full rate */
  calmDelay: 2,
  calmFull: 4,
  smoothMaxAccel: 2.5,
  smoothMaxLateral: 3,
  sharpTurnAccel: 4.5,
  sharpTurnPerSec: -0.5,
  /** braking must ease above this (m/s²) before another harsh brake can count */
  harshRearm: -3,
  /** a crash decelerates hard too — no extra harsh-brake penalty this soon after an impact (s) */
  impactGrace: 0.6,
  /** §7: stopped in the sun for 5 s or more before the heat starts to hurt */
  heatGrace: 5,
  /** m/s; slower than this counts as "stopped" for the heat rule */
  heatStopSpeed: 1,
  reportInterval: 1,
} as const;

/** the cat-ear helmet makes a good first impression (catalog: "손님 첫인상 +1"): passengers start more relaxed */
export const CAT_HELMET_COMFORT = 5;
export const startingComfort = (helmet: HelmetId, gear: GearId = 'none'): number =>
  Math.min(100, COMFORT.start + (helmet === 'helmet_cat' ? CAT_HELMET_COMFORT : 0) + (seatPerkOf(gear)?.start ?? 0));

/** the passenger-comfort perk of the equipped pillion gear (cushion / backrest / throne), null for other gear */
export const seatPerkOf = (gear: GearId): SeatPerk | null => itemById(`gear:${gear}`)?.perk ?? null;

/** discrete events a seat perk softens (falls are not softened) */
export const JOLT_EVENTS: ReadonlySet<ComfortEvent> = new Set<ComfortEvent>(['nearMiss', 'harshBrake', 'mirror', 'body']);

/** base delta of each discrete event */
export const COMFORT_EVENT_DELTA: Readonly<Record<ComfortEvent, number>> = {
  nearMiss: COMFORT.nearMiss,
  harshBrake: COMFORT.harshBrake,
  mirror: COMFORT.mirror,
  body: COMFORT.body,
  fall: COMFORT.fall,
  raincoat: COMFORT.careGift,
  mask: COMFORT.careGift,
};

/** frights scaled by the trait's scareMult; body hits and falls hurt everyone the same */
export const SCARE_EVENTS: ReadonlySet<ComfortEvent> = new Set<ComfortEvent>(['nearMiss', 'harshBrake', 'mirror']);
