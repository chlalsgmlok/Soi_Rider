import type { EventBus } from '../core/events';
import { INTENSITY } from '../core/config/traffic';
import type { TrafficIntensity } from '../core/types';
import type { TrafficCaps, TrafficConditions } from './sim/types';

export interface TrafficOptions {
  intensity?: TrafficIntensity;
  /** agent budget; defaults to the medium quality hints (48 cars → motorbikes by motoShare, 34 pedestrians) */
  caps?: Partial<TrafficCaps>;
  /** event bus for NPC horns (null = silent, default = the app bus) */
  bus?: EventBus | null;
  conditions?: TrafficConditions;
  /** run the NPC overlap audit every step (tests / sandbox stats) */
  audit?: boolean;
}

/** motorbike budget that keeps motoShare of the vehicle mix for a given four-wheeler budget */
export function motoBudget(cars: number, intensity: TrafficIntensity): number {
  const m = INTENSITY[intensity].motoShare;
  return Math.round((cars * m) / (1 - m));
}

/**
 * Agent budget from the engine quality hints: `maxNpcVehicles` caps the four-wheelers, motorbikes come on top by
 * motoShare (they are a few instanced draw calls), `maxPedestrians` caps people.
 */
export function capsFor(hints: { maxNpcVehicles: number; maxPedestrians: number }, intensity: TrafficIntensity): TrafficCaps {
  return { cars: hints.maxNpcVehicles, motos: motoBudget(hints.maxNpcVehicles, intensity), pedestrians: hints.maxPedestrians };
}
