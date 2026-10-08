import type { Rng } from '../../core/rng';
import type { CityQuery } from '../../core/types';
import type { Obstacles } from '../sim/obstacles';
import type { SignalBank } from '../sim/signals';
import type { Pedestrian } from './pedestrian';
import type { SidewalkNet } from './sidewalk-net';

/** Shared state for one pedestrian step. */
export interface PedCtx {
  readonly net: SidewalkNet;
  readonly city: CityQuery;
  readonly signals: SignalBank;
  /** vehicles + rider (+ pedestrians) snapshot of this step */
  readonly obstacles: Obstacles;
  readonly rng: Rng;
  readonly peds: readonly Pedestrian[];
  byId(id: number): Pedestrian | undefined;
  dt: number;
  /** INTENSITY.jaywalkChance */
  jaywalkChance: number;
}

/** walking speeds (m/s) */
export const WALK = { monk: 0.85, crossSignal: 1.5, crossInformal: 1.45, jaywalk: 1.75 } as const;
