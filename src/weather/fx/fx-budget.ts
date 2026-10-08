import type { QualityPreset } from '../../core/types';
import type { QualitySettings } from '../../engine/quality';

/** Particle / instance budgets of the weather FX per quality preset (rain drops come from the engine hint). */
export interface FxBudget {
  rainDrops: number;
  /** raindrop ripples on the ground */
  ripples: number;
  /** spray + steam + splash mist */
  mist: number;
  /** puddle-splash droplets */
  drops: number;
  /** exhaust soot puffs */
  smoke: number;
  /** drifting smog banks */
  hazeCards: number;
  /** sunbeam dust motes (0 = off) */
  motes: number;
  /** street-light / neon / tail-light streaks on the wet road */
  reflections: boolean;
}

const BUDGETS: Readonly<Record<QualityPreset, Omit<FxBudget, 'rainDrops'>>> = {
  low: { ripples: 110, mist: 420, drops: 260, smoke: 160, hazeCards: 16, motes: 0, reflections: true },
  medium: { ripples: 240, mist: 900, drops: 520, smoke: 320, hazeCards: 30, motes: 140, reflections: true },
  high: { ripples: 420, mist: 1700, drops: 900, smoke: 560, hazeCards: 44, motes: 260, reflections: true },
};

export const fxBudget = (q: QualitySettings): FxBudget => ({ ...BUDGETS[q.preset], rainDrops: q.rainDrops });
