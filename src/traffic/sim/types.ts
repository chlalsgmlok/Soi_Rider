import type { OBB, TimeOfDay, VehicleKind, Vec2 } from '../../core/types';

/** What the traffic simulation needs to know about the rider (a subset of PlayerState). */
export interface TrafficPlayer {
  readonly pos: Vec2;
  readonly heading: number;
  /** signed m/s along heading */
  readonly speed: number;
  /** body hull — NPCs treat it as an obstacle whenever it overlaps their path corridor */
  readonly obb: OBB;
}

/**
 * Answers "could the camera see an agent standing here?" so the spawner never pops vehicles or pedestrians in on
 * screen and only removes them where nobody is looking. Implemented in three.js land by `CameraProbe`.
 */
export interface ViewProbe {
  isVisible(p: Vec2, radius: number): boolean;
}

/** simultaneous agent budget (from the quality hints, overridable for stress tests) */
export interface TrafficCaps {
  cars: number;
  motos: number;
  pedestrians: number;
  /** multiplier on the walker density (crowd scenes / stress tests); default 1 */
  crowd?: number;
}

export interface TrafficConditions {
  timeOfDay: TimeOfDay;
  /** 0..1 rain amount (umbrellas, ponchos) */
  rain: number;
}

/** a pedestrian had to jump back because the rider came at them fast (scoring counts it as a scare) */
export interface PedScare {
  id: number;
  pos: Vec2;
  speedKmh: number;
}

/** a bus / songthaew / tuk-tuk pulled away hard — weather/haze can puff smoke at `pos` */
export interface ExhaustPuff {
  pos: Vec2;
  /** heading the smoke leaves along (vehicle heading + π) */
  heading: number;
  /** 0..1 */
  strength: number;
  kind: VehicleKind;
}

export interface TrafficStats {
  cars: number;
  motos: number;
  pedestrians: number;
  /** mean |speed| of moving-capable NPC vehicles (m/s) */
  avgSpeed: number;
  /** NPC–NPC body overlaps deeper than 0.2 m found by the last audit */
  overlaps: number;
  /** deepest NPC–NPC body penetration of the last audit (m) */
  maxOverlap: number;
  /** vehicles despawned by the deadlock breaker so far */
  unstuck: number;
  /** ring radius the density target currently fits into (m) */
  ringRadius: number;
  /** last fixed step cost (ms) */
  stepMs: number;
}

/** Pedestrian ids start here so one id space covers vehicles and pedestrians (`nudge`, collision `other`). */
export const PED_ID_BASE = 1_000_000;
