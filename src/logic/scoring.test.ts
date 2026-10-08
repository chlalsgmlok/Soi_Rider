import { describe, expect, it } from 'vitest';
import { FAIL_COMMENTS, GRADE_COMMENTS } from './comments';
import { computeEarnings, fareFor, tipRateFor } from './earnings';
import { betterGrade, gradeFor, starsFor } from './grade';
import {
  buildScoreLines, careScore, comfortScore, formatClock, penaltyScore, safetyScore, styleScore, timeScore,
} from './score-lines';
import { computeResult } from './scoring';
import { makeConfig, makeJob, makeStats } from './testing/fixtures';

describe('time score', () => {
  it('follows 1500 × clamp(2·(ETA − t)/ETA, −0.5, 1)', () => {
    expect(timeScore(300, 150, 'shopper')).toBe(1500);
    expect(timeScore(300, 0, 'shopper')).toBe(1500);
    expect(timeScore(300, 225, 'shopper')).toBe(750);
    expect(timeScore(300, 300, 'shopper')).toBe(0);
    expect(timeScore(300, 330, 'shopper')).toBe(-300);
    expect(timeScore(300, 375, 'shopper')).toBe(-750);
    expect(timeScore(300, 900, 'shopper')).toBe(-750);
  });

  it('doubles for hurry passengers, capped at 3000 (penalties double too)', () => {
    expect(timeScore(300, 200, 'hurry')).toBe(2000);
    expect(timeScore(300, 150, 'hurry')).toBe(3000);
    expect(timeScore(300, 0, 'hurry')).toBe(3000);
    expect(timeScore(300, 900, 'hurry')).toBe(-1500);
  });

  it('is 0 without a valid ETA', () => {
    expect(timeScore(0, 100, 'regular')).toBe(0);
    expect(timeScore(Number.NaN, 100, 'regular')).toBe(0);
  });
});

describe('other lines', () => {
  it('safety: 2000 minus incident costs, floored at 0', () => {
    expect(safetyScore(makeStats())).toBe(2000);
    expect(safetyScore(makeStats({ falls: 1, mirrorClips: 2 }))).toBe(1160);
    expect(safetyScore(makeStats({ bumps: 1, pedScares: 1, curbHits: 2, redLights: 1 }))).toBe(2000 - 250 - 150 - 80 - 200);
    expect(safetyScore(makeStats({ falls: 4 }))).toBe(0);
  });

  it('comfort ×20 within 0..2000, style capped at 3000', () => {
    expect(comfortScore(73.4)).toBe(1468);
    expect(comfortScore(100)).toBe(2000);
    expect(comfortScore(-5)).toBe(0);
    expect(styleScore(makeStats({ stylePoints: 1234 }))).toBe(1234);
    expect(styleScore(makeStats({ stylePoints: 3500 }))).toBe(3000);
  });

  it('care: raincoat 400, mask 300, smooth arrival 300, landmarks 150 each (tourists only, max 3)', () => {
    expect(careScore(makeStats({ raincoat: 'given', mask: 'given', smoothArrival: true }), 'nervous')).toBe(1000);
    expect(careScore(makeStats({ raincoat: 'missed', mask: 'na' }), 'nervous')).toBe(0);
    expect(careScore(makeStats({ landmarkBonus: 2 }), 'tourist')).toBe(300);
    expect(careScore(makeStats({ landmarkBonus: 5 }), 'tourist')).toBe(450);
    expect(careScore(makeStats({ landmarkBonus: 5 }), 'regular')).toBe(0);
  });

  it('penalty: −15/s counterflow, −20/s sidewalk', () => {
    expect(penaltyScore(makeStats({ counterflowSec: 4, sidewalkSec: 2 }))).toBe(-100);
    expect(penaltyScore(makeStats({ counterflowSec: 0.5 }))).toBe(-8);
    expect(Object.is(penaltyScore(makeStats()), 0)).toBe(true);
  });

  it('builds Korean receipt lines with detail strings', () => {
    const lines = buildScoreLines(makeStats({ falls: 1, mirrorClips: 2, counterflowSec: 4, sidewalkSec: 0.3, raincoat: 'given',
      mask: 'missed', nearMisses: 3, maxCombo: 2 }), 'hurry');
    const by = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(lines.map((l) => l.key)).toEqual(['delivery', 'time', 'safety', 'comfort', 'style', 'care', 'penalty']);
    expect(by.delivery.label).toBe('기본 배달');
    expect(by.safety.detail).toBe('넘어짐 1 · 미러 2');
    expect(by.time.detail).toBe('예상 05:00 · 실제 04:00 · 급해요 ×2');
    expect(by.style.detail).toBe('니어미스 3 · 최대 콤보 2');
    expect(by.care.detail).toBe('우비 · 마스크 놓침');
    expect(by.penalty.detail).toBe('역주행 4초 · 인도 1초');
    expect(buildScoreLines(makeStats(), 'regular').find((l) => l.key === 'safety')?.detail).toBe('무사고');
    expect(formatClock(192)).toBe('03:12');
    expect(formatClock(-65)).toBe('-01:05');
  });
});

describe('grade and stars', () => {
  it('grade thresholds are inclusive lower bounds', () => {
    expect(gradeFor(7500, false)).toBe('S');
    expect(gradeFor(7499, false)).toBe('A');
    expect(gradeFor(6000, false)).toBe('A');
    expect(gradeFor(5999, false)).toBe('B');
    expect(gradeFor(4500, false)).toBe('B');
    expect(gradeFor(4499, false)).toBe('C');
    expect(gradeFor(3000, false)).toBe('C');
    expect(gradeFor(2999, false)).toBe('D');
    expect(gradeFor(-800, false)).toBe('D');
    expect(gradeFor(99999, true)).toBe('F');
  });

  it('stars = 1 + 4·comfort/100 rounded to 0.5, −1 when late, min 1', () => {
    expect(starsFor(80, false, false)).toBe(4);
    expect(starsFor(81.25, false, false)).toBe(4.5);
    expect(starsFor(81.2, false, false)).toBe(4);
    expect(starsFor(93.75, false, false)).toBe(5);
    expect(starsFor(100, false, false)).toBe(5);
    expect(starsFor(80, true, false)).toBe(3);
    expect(starsFor(10, true, false)).toBe(1);
    expect(starsFor(0, false, false)).toBe(1);
    expect(starsFor(100, false, true)).toBe(1);
  });

  it('betterGrade keeps the best', () => {
    expect(betterGrade(null, 'D')).toBe('D');
    expect(betterGrade('B', 'A')).toBe('A');
    expect(betterGrade('S', 'A')).toBe('S');
  });
});

describe('money', () => {
  it('fare = 40 + m × 0.08 × intensity multiplier, rounded', () => {
    expect(fareFor(1000, 'light')).toBe(120);
    expect(fareFor(1000, 'rush')).toBe(140);
    expect(fareFor(1000, 'gridlock')).toBe(160);
    expect(fareFor(433, 'rush')).toBe(83);
    expect(fareFor(350, 'light')).toBe(68);
  });

  it('tip rate by grade: S .6 · A .4 · B .2 · C .1 · D 0, plus raincoat 20 ฿ and mask 15 ฿', () => {
    const job = makeJob('shopper', 100);
    const tips = (['S', 'A', 'B', 'C', 'D'] as const).map((g) => computeEarnings(job, makeStats(), g).tipBaht);
    expect(tips).toEqual([60, 40, 20, 10, 0]);
    const care = computeEarnings(job, makeStats({ raincoat: 'given', mask: 'given' }), 'A');
    expect(care).toEqual({ fareBaht: 100, tipBaht: 75, bonusBaht: 0, totalBaht: 175 });
  });

  it('nervous passengers tip ×1.5 for a smooth ride; regulars tip half but add a 30 ฿ bonus', () => {
    expect(tipRateFor(makeJob('nervous'), makeStats({ finalComfort: 90 }), 'S')).toBeCloseTo(0.9);
    expect(computeEarnings(makeJob('nervous', 100), makeStats({ finalComfort: 84.9 }), 'S').tipBaht).toBe(60);
    expect(computeEarnings(makeJob('regular', 100), makeStats(), 'S')).toEqual({ fareBaht: 100, tipBaht: 30, bonusBaht: 30, totalBaht: 160 });
  });

  it('a failed run earns 0 ฿', () => {
    expect(computeEarnings(makeJob('regular', 100), makeStats({ failed: 'falls', raincoat: 'given' }), 'F').totalBaht).toBe(0);
  });
});

describe('computeResult', () => {
  it('sums the lines into total, grade, stars and money', () => {
    const stats = makeStats({ timeSec: 150, finalComfort: 90, stylePoints: 1200, nearMisses: 10, raincoat: 'given', smoothArrival: true });
    const r = computeResult(makeConfig(), makeJob('shopper', 120), stats, 7000);
    /* 1000 + 1500 + 2000 + 1800 + 1200 + 700 + 0 */
    expect(r.total).toBe(8200);
    expect(r.grade).toBe('S');
    expect(r.stars).toBe(4.5);
    expect(r.fareBaht).toBe(120);
    expect(r.tipBaht).toBe(72 + 20);
    expect(r.totalBaht).toBe(212);
    expect(r.newBest).toBe(true);
    expect(r.stats).toEqual(stats);
    expect(r.stats).not.toBe(stats);
    expect(GRADE_COMMENTS.S.base.concat(GRADE_COMMENTS.S.trait?.shopper ?? []).map((t) => t.replaceAll('{kha}', '카')))
      .toContain(r.passengerComment);
  });

  it('late arrival: negative time score and −1 star', () => {
    const r = computeResult(makeConfig(), makeJob('shopper'), makeStats({ timeSec: 375, finalComfort: 80 }));
    expect(r.lines.find((l) => l.key === 'time')?.value).toBe(-750);
    expect(r.total).toBe(1000 - 750 + 2000 + 1600);
    expect(r.grade).toBe('C');
    expect(r.stars).toBe(3);
    expect(r.newBest).toBe(false);
  });

  it('a failed run is F, 1 star, 0 ฿, with a fail comment and no new best', () => {
    const r = computeResult(makeConfig(), makeJob('nervous'), makeStats({ failed: 'comfort', finalComfort: 0, timeSec: 100 }), 0);
    expect(r.grade).toBe('F');
    expect(r.stars).toBe(1);
    expect(r.totalBaht).toBe(0);
    expect(r.lines[0]).toEqual({ key: 'delivery', label: '기본 배달', value: 0, detail: '손님이 중간에 내림' });
    expect(r.lines[1].value).toBe(0);
    expect(r.total).toBe(0);
    expect(r.lines.at(-1)).toMatchObject({ key: 'penalty', label: '운행 실패' });
    expect(r.lines.reduce((s, l) => s + l.value, 0)).toBe(0);
    expect(r.newBest).toBe(false);
    expect(FAIL_COMMENTS.comfort).toContain(r.passengerComment);
  });

  it('uses the male particle for male passengers and is deterministic per seed', () => {
    const job = makeJob('regular', 100, '솜차이');
    const a = computeResult(makeConfig({ seed: 99 }), job, makeStats({ finalComfort: 100, timeSec: 100 }));
    const b = computeResult(makeConfig({ seed: 99 }), job, makeStats({ finalComfort: 100, timeSec: 100 }));
    expect(a.passengerComment).toBe(b.passengerComment);
    expect(a.passengerComment).not.toContain('{kha}');
    for (let seed = 0; seed < 60; seed++) {
      const c = computeResult(makeConfig({ seed }), makeJob('tourist', 100, '켄'), makeStats({ finalComfort: 100, timeSec: 10 }));
      expect(c.passengerComment).not.toMatch(/컵쿤카/);
    }
  });
});
