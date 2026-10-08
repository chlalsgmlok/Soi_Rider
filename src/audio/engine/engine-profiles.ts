import type { BikeModelId } from '../../core/types';

export interface Band {
  f: number;
  q: number;
  gain: number;
}

/** Sound design of one bike engine (data table). Frequencies in Hz, levels linear. */
export interface EngineProfile {
  id: BikeModelId;
  idleRpm: number;
  redRpm: number;
  /** firing events in the 720° cycle: [phase 0..1, strength] */
  firing: ReadonlyArray<readonly [number, number]>;
  /** exhaust pop width as a fraction of the cycle (narrow = crisp putt, wide = smooth drone) */
  pulseWidth: number;
  /** exhaust/muffler resonances the pulse train excites */
  formants: Band[];
  /** direct (unfiltered) pulse level — the "putt" transient */
  click: number;
  /** muffler lowpass base cutoff, opened by rpm and load */
  muffler: number;
  brightRpm: number;
  brightLoad: number;
  /** saturation drive and positive-half asymmetry */
  grit: number;
  asym: number;
  /** sub sine at subHarm × cycle frequency (body / drone) */
  sub: number;
  subHarm: number;
  /** exhaust breath noise band, amplitude-modulated per firing */
  chuff: Band;
  /** valve/cam clatter band (not muffled) */
  mech: Band;
  /** CVT belt / chain whine: base + perSpeed × speed01 (Hz) */
  whine: { base: number; perSpeed: number; gain: number } | null;
  /** cycle-to-cycle irregularity at idle */
  wobbleCents: number;
  wobbleAmp: number;
  /** speed01 at which each gear reaches redline; null = CVT */
  gears: number[] | null;
  /** clutch slip rpm01 per unit throttle at low speed */
  slip: number;
  /** ignition cut on upshift (s) */
  shiftCut: number;
  /** overrun crackle tendency 0..1 */
  pops: number;
  level: number;
}

export const ENGINE_PROFILES: Record<BikeModelId, EngineProfile> = {
  /** Wavey 110 step-through: putt-putt 4-stroke single, 4-speed rotary box, centrifugal clutch. */
  cub: {
    id: 'cub', idleRpm: 1500, redRpm: 8800,
    firing: [[0, 1]], pulseWidth: 0.03,
    formants: [{ f: 165, q: 4.5, gain: 1 }, { f: 420, q: 4, gain: 0.55 }, { f: 1150, q: 3, gain: 0.2 }],
    click: 0.06, muffler: 820, brightRpm: 1.6, brightLoad: 1.4, grit: 2.2, asym: 0.35,
    sub: 0.22, subHarm: 2,
    chuff: { f: 340, q: 1.3, gain: 0.3 }, mech: { f: 2600, q: 1.6, gain: 0.05 },
    whine: null, wobbleCents: 45, wobbleAmp: 0.22,
    gears: [0.3, 0.53, 0.77, 1.03], slip: 0.42, shiftCut: 0.15, pops: 0.12, level: 1.1,
  },
  /** Kitti 125 scooter: muffled droney single, CVT holds rpm while the belt whines up with speed. */
  scooter: {
    id: 'scooter', idleRpm: 1700, redRpm: 8200,
    firing: [[0, 1]], pulseWidth: 0.055,
    formants: [{ f: 135, q: 3.2, gain: 1 }, { f: 300, q: 3, gain: 0.45 }, { f: 760, q: 2, gain: 0.12 }],
    click: 0.02, muffler: 620, brightRpm: 1.1, brightLoad: 0.9, grit: 1.5, asym: 0.15,
    sub: 0.42, subHarm: 2,
    chuff: { f: 260, q: 1, gain: 0.18 }, mech: { f: 3300, q: 2, gain: 0.035 },
    whine: { base: 420, perSpeed: 1450, gain: 0.05 }, wobbleCents: 22, wobbleAmp: 0.1,
    gears: null, slip: 0.5, shiftCut: 0, pops: 0, level: 1.0,
  },
  /** Naga 300 naked: deep 270° parallel-twin rumble, 6-speed, quickshifter, crackles on overrun. */
  sport: {
    id: 'sport', idleRpm: 1300, redRpm: 11500,
    firing: [[0, 1], [0.375, 0.85]], pulseWidth: 0.022,
    formants: [
      { f: 105, q: 4, gain: 1 }, { f: 280, q: 3.5, gain: 0.6 },
      { f: 740, q: 2.5, gain: 0.26 }, { f: 1900, q: 2, gain: 0.08 },
    ],
    click: 0.05, muffler: 1000, brightRpm: 1.9, brightLoad: 1.5, grit: 2.6, asym: 0.25,
    sub: 0.34, subHarm: 2,
    chuff: { f: 210, q: 1, gain: 0.32 }, mech: { f: 2200, q: 1.3, gain: 0.045 },
    whine: { base: 0, perSpeed: 900, gain: 0.02 }, wobbleCents: 20, wobbleAmp: 0.12,
    gears: [0.21, 0.35, 0.49, 0.63, 0.8, 1.0], slip: 0.5, shiftCut: 0.07, pops: 0.6, level: 1.15,
  },
};
