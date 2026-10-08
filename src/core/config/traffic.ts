import type { TrafficIntensity } from '../types/game';
import type { VehicleKind, VehicleSpec } from '../types/vehicles';
import { PALETTE as P } from './palette';

const kmh = (v: number): number => v / 3.6;

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  taxi: {
    kind: 'taxi', model: 'veh_taxi', length: 4.6, width: 1.76, mirrorSpan: 2.0, mirrorZ: 0.75, mirrorY: 1.0,
    maxSpeed: kmh(60), accel: 2.2, decel: 4.5, weight: 5,
    paints: [[P.taxiPink, P.taxiPink], [P.taxiGreen, P.taxiYellow], [P.taxiRed, P.taxiBlue], [P.taxiOrange, P.taxiOrange],
      [P.taxiYellow, P.taxiGreen], [P.taxiBlue, P.taxiBlue]],
  },
  sedan: {
    kind: 'sedan', model: 'veh_sedan', length: 4.5, width: 1.75, mirrorSpan: 1.98, mirrorZ: 0.7, mirrorY: 1.0,
    maxSpeed: kmh(65), accel: 2.4, decel: 4.8, weight: 4,
    paints: [[P.carSilver, P.carSilver], [P.carWhite, P.carWhite], [P.carBlack, P.carBlack], [P.carBeige, P.carBeige],
      [P.carNavy, P.carNavy], [P.carMaroon, P.carMaroon]],
  },
  van: {
    kind: 'van', model: 'veh_van', length: 5.4, width: 1.9, mirrorSpan: 2.18, mirrorZ: 1.75, mirrorY: 1.45,
    maxSpeed: kmh(60), accel: 1.8, decel: 4.0, weight: 3,
    paints: [[P.vanWhite, P.vanWhite], [P.carSilver, P.carSilver]],
  },
  pickup: {
    kind: 'pickup', model: 'veh_pickup', length: 5.3, width: 1.85, mirrorSpan: 2.1, mirrorZ: 1.0, mirrorY: 1.2,
    maxSpeed: kmh(60), accel: 2.0, decel: 4.2, weight: 2,
    paints: [[P.carWhite, P.carWhite], [P.carSilver, P.carSilver], [P.carBlack, P.carBlack], [P.taxiRed, P.taxiRed]],
  },
  tuktuk: {
    kind: 'tuktuk', model: 'veh_tuktuk', length: 3.0, width: 1.4, mirrorSpan: 1.6, mirrorZ: 1.1, mirrorY: 1.3,
    maxSpeed: kmh(45), accel: 2.0, decel: 4.0, weight: 2,
    paints: [[P.tuktukBlue, P.taxiYellow], [P.taxiGreen, P.taxiYellow], [P.taxiRed, P.taxiYellow], [P.taxiPink, P.carWhite]],
  },
  bus: {
    kind: 'bus', model: 'veh_bus', length: 11.5, width: 2.5, mirrorSpan: 2.9, mirrorZ: 5.4, mirrorY: 2.1,
    maxSpeed: kmh(45), accel: 1.1, decel: 3.0, weight: 1,
    paints: [[P.busRed, P.busCream], [P.taxiBlue, P.busCream]],
  },
  songthaew: {
    kind: 'songthaew', model: 'veh_songthaew', length: 5.0, width: 1.8, mirrorSpan: 2.05, mirrorZ: 1.3, mirrorY: 1.2,
    maxSpeed: kmh(50), accel: 1.8, decel: 4.0, weight: 1,
    paints: [[P.busRed, P.busRed], [P.taxiBlue, P.taxiBlue]],
  },
  moto: {
    kind: 'moto', model: 'bike_cub', length: 1.9, width: 0.72, mirrorSpan: 0.8, mirrorZ: 0.5, mirrorY: 1.12,
    maxSpeed: kmh(55), accel: 2.8, decel: 6.0, weight: 0,
    paints: [[P.taxiRed, P.carBlack], [P.carBlack, P.carBlack], [P.taxiBlue, P.carWhite], [P.carWhite, P.carSilver],
      [P.taxiPink, P.carWhite], [P.taxiGreen, P.carBlack]],
  },
};

export interface IntensityConfig {
  id: TrafficIntensity;
  label: string;
  labelTh: string;
  /** vehicles per lane per 100 m */
  density: number;
  signalCycle: number;
  /** desired-speed multiplier applied to lane speed limits */
  flow: number;
  motoShare: number;
  /** reference speed for ETA (m/s) */
  etaSpeed: number;
  fareMult: number;
  pedestrianDensity: number;
  jaywalkChance: number;
}

export const INTENSITY: Record<TrafficIntensity, IntensityConfig> = {
  light: {
    id: 'light', label: '한산', labelTh: 'โล่ง', density: 1.4, signalCycle: 30, flow: 1.0, motoShare: 0.25,
    etaSpeed: kmh(22), fareMult: 1.0, pedestrianDensity: 0.5, jaywalkChance: 0.05,
  },
  rush: {
    id: 'rush', label: '러시아워', labelTh: 'ชั่วโมงเร่งด่วน', density: 3.6, signalCycle: 45, flow: 0.45, motoShare: 0.4,
    etaSpeed: kmh(14), fareMult: 1.25, pedestrianDensity: 0.9, jaywalkChance: 0.12,
  },
  gridlock: {
    id: 'gridlock', label: '극심 정체', labelTh: 'รถติดมาก', density: 5.2, signalCycle: 70, flow: 0.18, motoShare: 0.5,
    etaSpeed: kmh(9), fareMult: 1.5, pedestrianDensity: 1.2, jaywalkChance: 0.2,
  },
};
