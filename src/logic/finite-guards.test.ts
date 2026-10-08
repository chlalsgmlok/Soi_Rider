import { describe, expect, it } from 'vitest';
import type { RunResult } from '../core/types';
import { ComfortModel } from './comfort';
import { fareFor } from './earnings';
import { applyPayout } from './economy';
import { gradeFor, starsFor } from './grade';
import { createDefaultSave } from './save-defaults';
import { comfortScore, formatClock, timeScore } from './score-lines';
import { computeResult } from './scoring';
import { makeConfig, makeJob, makeStats } from './testing/fixtures';

/** a NaN from a physics glitch upstream must never reach the receipt or the wallet */
describe('non-finite inputs', () => {
  it('formulas map NaN / ±Infinity to 0', () => {
    expect(comfortScore(Number.NaN)).toBe(0);
    expect(comfortScore(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(starsFor(Number.NaN, false, false)).toBe(1);
    expect(starsFor(Number.NaN, true, false)).toBe(1);
    expect(gradeFor(Number.NaN, false)).toBe('D');
    expect(fareFor(Number.NaN, 'rush')).toBe(40);
    expect(fareFor(Number.POSITIVE_INFINITY, 'gridlock')).toBe(40);
    expect(fareFor(-50, 'light')).toBe(40);
    expect(timeScore(300, Number.NaN, 'hurry')).toBe(0);
    expect(timeScore(Number.POSITIVE_INFINITY, 10, 'shopper')).toBe(0);
    expect(formatClock(Number.NaN)).toBe('--:--');
  });

  it('a NaN final comfort scores like comfort 0 instead of poisoning the total', () => {
    const nan = computeResult(makeConfig(), makeJob('shopper'), makeStats({ finalComfort: Number.NaN }));
    const zero = computeResult(makeConfig(), makeJob('shopper'), makeStats({ finalComfort: 0 }));
    /* 1000 + 1500 × 0.4 + 2000 + 0 + 0 + 0 + 0 */
    expect(nan.total).toBe(3600);
    expect([nan.total, nan.grade, nan.stars]).toEqual([zero.total, zero.grade, zero.stars]);
    expect(nan.grade).toBe('C');
    expect(nan.stars).toBe(1);
    expect(nan.lines.find((l) => l.key === 'comfort')).toMatchObject({ value: 0, detail: '승차감 0' });
  });

  it('garbage counters and timers leave every receipt line a finite number', () => {
    const r = computeResult(makeConfig(), makeJob('tourist'), makeStats({
      falls: Number.NaN, bumps: Number.POSITIVE_INFINITY, stylePoints: Number.NaN, landmarkBonus: Number.NaN,
      counterflowSec: Number.NaN, sidewalkSec: -4, timeSec: Number.NaN,
    }));
    for (const line of r.lines) expect(Number.isFinite(line.value)).toBe(true);
    /* non-finite counters count as empty: safety stays 2000, time / style / care / penalty 0 */
    expect(r.lines.map((l) => l.value)).toEqual([1000, 0, 2000, 1600, 0, 0, 0]);
    expect(r.total).toBe(4600);
    expect(r.lines[1].detail).toBe('예상 05:00 · 실제 --:--');
    expect(r.lines.filter((l) => /NaN|Infinity/.test(l.detail))).toEqual([]);
    expect(Number.isFinite(r.total)).toBe(true);
    expect(Number.isFinite(r.totalBaht)).toBe(true);
  });

  it('applyPayout never books NaN baht or a NaN best score', () => {
    const base = computeResult(makeConfig(), makeJob('shopper'), makeStats());
    const broken: RunResult = { ...base, total: Number.NaN, totalBaht: Number.NaN };
    const save = applyPayout(createDefaultSave(), broken);
    expect([save.baht, save.bestScore, save.tripsCompleted]).toEqual([300, 0, 1]);
  });

  it('ComfortModel ignores a NaN start, NaN time steps and NaN sensor readings', () => {
    const m = new ComfortModel('regular', Number.NaN);
    expect(m.value).toBe(80);
    const still = { speed: 5, accel: 0, counterflow: true, sidewalk: false, rainingNoPoncho: false, smogNoMask: false, heatStoppedUnshaded: false };
    expect(m.tick(Number.NaN, still)).toEqual([]);
    expect(m.value).toBe(80);
    for (let i = 0; i < 120; i++) m.tick(1 / 60, { ...still, counterflow: false, speed: Number.NaN, accel: Number.NaN, lateralAccel: Number.NaN });
    expect(Number.isFinite(m.value)).toBe(true);
    expect(m.failed).toBe(false);
  });
});
