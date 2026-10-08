import { describe, expect, it } from 'vitest';
import type { TrafficIntensity } from '../core/types';
import { OVERLAP_TOLERANCE } from './sim/overlap-audit';
import { cityQuery, sidewalkPlayer, STEP, system } from './testing/sim-fixtures';

const SECONDS = 180;

interface RunSummary {
  overlapSteps: number;
  maxDepth: number;
  avgSpeedLast60: number;
  movedShare: number;
  vehicles: number;
  maxStuckNear: number;
  unstuck: number;
}

/**
 * 180 s of traffic around a rider standing on a corner sidewalk at the busiest junction, audited every fixed step
 * (hull vs hull SAT over all live NPC vehicles).
 */
function run(intensity: TrafficIntensity, district: 'sukhumvit' | 'silom', seed: number): RunSummary {
  const city = cityQuery(seed, district);
  const player = sidewalkPlayer(city);
  const sys = system(city, intensity, 60, 30, seed + 11);
  const start = new Map<number, { x: number; z: number }>();
  let overlapSteps = 0;
  let maxDepth = 0;
  let speedSum = 0;
  let speedN = 0;
  const moved = new Set<number>();
  for (let step = 0; step < SECONDS * 60; step++) {
    sys.update(STEP, player, intensity);
    const rep = sys.overlapReport();
    if (rep.count > 0) overlapSteps++;
    maxDepth = Math.max(maxDepth, rep.max);
    for (const v of sys.vehicles()) {
      const s0 = start.get(v.id);
      if (!s0) start.set(v.id, { x: v.pos.x, z: v.pos.z });
      else if (Math.hypot(v.pos.x - s0.x, v.pos.z - s0.z) > 15) moved.add(v.id);
      if (step >= (SECONDS - 60) * 60) {
        speedSum += v.speed;
        speedN++;
      }
    }
  }
  let maxStuckNear = 0;
  for (const v of sys.vehicles()) {
    if (Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) < 60) maxStuckNear = Math.max(maxStuckNear, v.stuck);
  }
  return {
    overlapSteps, maxDepth, avgSpeedLast60: speedSum / Math.max(1, speedN), movedShare: moved.size / Math.max(1, start.size),
    vehicles: sys.vehicles().length, maxStuckNear, unstuck: sys.stats().unstuck,
  };
}

describe('headless traffic simulation (180 s per intensity)', () => {
  for (const intensity of ['light', 'rush', 'gridlock'] as const) {
    it(`${intensity}: no NPC–NPC body overlap > ${OVERLAP_TOLERANCE} m and traffic keeps flowing`, () => {
      const r = run(intensity, 'sukhumvit', 1);
      expect(r.vehicles).toBeGreaterThan(intensity === 'light' ? 30 : 80);
      expect(r.overlapSteps).toBe(0);
      expect(r.maxDepth).toBeLessThan(OVERLAP_TOLERANCE);
      // flowing: most vehicles that were ever alive covered > 15 m, the average speed never collapses to 0
      expect(r.movedShare).toBeGreaterThan(0.6);
      expect(r.avgSpeedLast60).toBeGreaterThan(intensity === 'light' ? 2.5 : intensity === 'rush' ? 1.0 : 0.4);
      // no permanent deadlock in sight of the rider
      expect(r.maxStuckNear).toBeLessThan(90);
    }, 900_000);
  }

  it('gridlock in another district (Silom) stays overlap-free and moving', () => {
    const r = run('gridlock', 'silom', 7);
    expect(r.overlapSteps).toBe(0);
    expect(r.avgSpeedLast60).toBeGreaterThan(0.4);
    expect(r.maxStuckNear).toBeLessThan(90);
  }, 900_000);
});
