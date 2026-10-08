import { VEHICLES } from '../../core/config/traffic';
import { PALETTE } from '../../core/config/palette';
import type { Rng } from '../../core/rng';
import type { DistrictId, TrafficIntensity, VehicleKind } from '../../core/types';
import { DISTRICTS } from '../../world';
import type { Vehicle } from './vehicle';

const CAR_KINDS: readonly VehicleKind[] = ['taxi', 'sedan', 'van', 'pickup', 'tuktuk', 'bus', 'songthaew'];
/** Bangkok street flavour on top of the spec weights: colourful taxis, commuter vans and tuk-tuks everywhere */
const STREET_BOOST: Partial<Record<VehicleKind, number>> = { taxi: 1.5, van: 1.2, tuktuk: 1.3, sedan: 0.8, pickup: 0.85 };

/**
 * Four-wheeler mix: the geometric mean of the global spawn weight (VEHICLES[k].weight) and the district's
 * flavour hint (Khaosan more tuk-tuks, Silom more vans/buses …), tilted toward the taxis / vans / tuk-tuks that
 * define a Bangkok street. Buses run a little more in rush hour.
 */
export function carWeights(district: DistrictId, intensity: TrafficIntensity): Array<[VehicleKind, number]> {
  const hint = DISTRICTS[district].traffic;
  return CAR_KINDS.map((k) => {
    const base = VEHICLES[k].weight;
    let w = Math.sqrt(base * (hint[k] ?? base)) * (STREET_BOOST[k] ?? 1);
    if (k === 'bus' && intensity !== 'light') w *= 1.3;
    return [k, w];
  });
}

export function pickCarKind(weights: ReadonlyArray<[VehicleKind, number]>, rng: Rng): VehicleKind {
  return rng.weighted(weights, (w) => w[1])[0];
}

/** body colours from the spec; private sedans sometimes get a contrasting black roof */
export function paintVehicle(v: Vehicle, rng: Rng): void {
  const [p1, p2] = rng.pick(v.spec.paints);
  v.paint = p1;
  v.paint2 = v.kind === 'sedan' && rng.chance(0.25) ? PALETTE.carBlack : p2;
  v.look = rng.int(0, 0x7fffffff);
}

/**
 * Driver temperament per intensity: desired-speed factor, IDM parameters and lateral habit. Denser traffic means
 * shorter headways and jam distances (Bangkok queues are tight) — heterogeneity is what starts stop-and-go waves.
 */
export function temperament(v: Vehicle, intensity: TrafficIntensity, rng: Rng): void {
  const dense = intensity === 'gridlock' ? 1 : intensity === 'rush' ? 0.5 : 0;
  v.v0 = rng.range(0.82, 1.15);
  if (v.isMoto) {
    v.idm = { a: v.spec.accel * rng.range(0.8, 1.1), b: 4, T: rng.range(0.7, 1.05), s0: rng.range(0.7, 1.0) };
    v.jitter = rng.pick([-0.6, 0, 0.9, 1.4, 2.2]);
    return;
  }
  const heavy = v.kind === 'bus' || v.kind === 'songthaew';
  v.idm = {
    a: v.spec.accel * rng.range(0.72, 1.0),
    b: Math.min(v.spec.decel, heavy ? 2.6 : 3.2),
    T: rng.range(1.15, 1.75) - dense * 0.3,
    s0: (heavy ? 2.4 : 2.0) - dense * 0.6 + rng.range(-0.2, 0.3),
  };
  v.jitter = rng.range(-0.3, 0.3);
}
