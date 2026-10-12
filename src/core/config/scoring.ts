import type { Grade, PassengerTrait } from '../types/game';

/** Scoring + comfort constants (docs/GAME_DESIGN.md §8, §10). Logic lives in src/logic/scoring.ts. */
export const SCORE = {
  delivery: 1000,
  timeMax: 1500,
  timeCap: 3000,
  safetyBase: 2000,
  fall: 600,
  bump: 250,
  mirror: 120,
  pedScare: 150,
  curb: 40,
  redLight: 200,
  comfortPerPoint: 20,
  nearMiss: 40,
  perfectGap: 150,
  filterPass: 15,
  styleCap: 3000,
  comboWindow: 2.5,
  comboStep: 0.25,
  comboMaxMult: 3,
  nearMissCm: 20,
  nearMissMinKmh: 10,
  perfectGapCm: 18,
  careRaincoat: 400,
  careMask: 300,
  careSmooth: 300,
  careLandmark: 150,
  counterflowPerSec: 15,
  /** riding against traffic with the bike centre this close (m) to the yellow centre line is tolerated */
  counterflowGraceM: 1.0,
  sidewalkPerSec: 20,
} as const;

export const GRADE_THRESHOLDS: ReadonlyArray<[Exclude<Grade, 'F'>, number]> = [
  ['S', 7500],
  ['A', 6000],
  ['B', 4500],
  ['C', 3000],
  ['D', -Infinity],
];

export const TIP_RATE: Record<Grade, number> = { S: 0.6, A: 0.4, B: 0.2, C: 0.1, D: 0, F: 0 };

export const FARE = { base: 40, perMeter: 0.08, raincoatTip: 20, maskTip: 15 } as const;

export const COMFORT = {
  start: 80,
  harshBrakeAccel: 6,
  harshBrake: -3,
  nearMiss: -1.5,
  mirror: -4,
  body: -10,
  fall: -25,
  counterflowPerSec: -0.8,
  sidewalkPerSec: -0.6,
  rainPerSec: -0.5,
  smogPerSec: -0.4,
  heatPerSec: -0.3,
  smoothPerSec: 0.15,
  careGift: 12,
  maxFalls: 3,
  timeoutFactor: 2.5,
} as const;

/** per-trait multipliers */
export const TRAITS: Record<PassengerTrait, { label: string; timeMult: number; scareMult: number; turnMult: number; extraWidth: number }> = {
  hurry: { label: '급해요', timeMult: 2, scareMult: 0.5, turnMult: 1, extraWidth: 0 },
  nervous: { label: '겁 많음', timeMult: 1, scareMult: 2, turnMult: 1.3, extraWidth: 0 },
  tourist: { label: '첫 방콕', timeMult: 1, scareMult: 1.2, turnMult: 1, extraWidth: 0 },
  shopper: { label: '짐 많음', timeMult: 1, scareMult: 1, turnMult: 1.5, extraWidth: 0.14 },
  regular: { label: '단골', timeMult: 1, scareMult: 0.7, turnMult: 0.8, extraWidth: 0 },
};
