import type { BikeModelId, BikeStats } from '../types/player';

const kmh = (v: number): number => v / 3.6;

/** Player bikes — numbers mirror docs/GAME_DESIGN.md §5. */
export const BIKES: Record<BikeModelId, BikeStats> = {
  cub: {
    id: 'cub', name: 'Wavey 110', model: 'bike_cub',
    topSpeed: kmh(70), accel: 2.6, brake: 6.5, handling: 0.62,
    wheelbase: 1.24, length: 1.85, width: 0.66, mirrorSpan: 0.76, mirrorY: 1.12, mirrorZ: 0.5, mass: 100,
  },
  scooter: {
    id: 'scooter', name: 'Kitti 125', model: 'bike_scooter',
    topSpeed: kmh(82), accel: 3.2, brake: 7.0, handling: 0.58,
    wheelbase: 1.28, length: 1.9, width: 0.7, mirrorSpan: 0.8, mirrorY: 1.15, mirrorZ: 0.55, mass: 112,
  },
  sport: {
    id: 'sport', name: 'Naga 300', model: 'bike_sport',
    topSpeed: kmh(110), accel: 4.4, brake: 8.2, handling: 0.5,
    wheelbase: 1.38, length: 2.0, width: 0.78, mirrorSpan: 0.86, mirrorY: 1.18, mirrorZ: 0.58, mass: 160,
  },
};

/** Handling tunables shared by physics + camera (docs/GAME_DESIGN.md §5). */
export const RIDE = {
  /** max steer angle at 60 km/h (rad); interpolated from BikeStats.handling at 0 km/h */
  steerAtSpeed: 0.12,
  steerRate: 3.2,
  leanOmega: 9,
  leanZeta: 0.75,
  maxLean: 0.78,
  riderLeanExtra: 0.15,
  gripDry: 0.95,
  gripWet: 0.6,
  feetDownBelow: 2.0,
  walkBackSpeed: 1.4,
  tuckWidthFactor: 0.78,
  tuckTopSpeed: kmh(15),
  /** passenger with shopping bags adds this to the effective width */
  bagsExtraWidth: 0.14,
  drag: 0.012,
  rolling: 0.35,
  fallSpeedKmh: 15,
  fallDuration: 2.5,
} as const;
