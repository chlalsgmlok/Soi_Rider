import { describe, expect, it } from 'vitest';
import { createDefaultSave } from './save-defaults';
import { settleRun } from './settle-run';
import { makeConfig, makeJob, makeStats } from './testing/fixtures';

/* 1000 + 1500 + 2000 + 1800 + 1200 + 700 + 0 = 8200 (S), fare 120 + tip 72 + raincoat 20 = 212 ฿ */
const greatRun = () => makeStats({ timeSec: 150, finalComfort: 90, stylePoints: 1200, nearMisses: 10, raincoat: 'given', smoothArrival: true });

describe('settleRun', () => {
  it('scores against the previous best and books the payout', () => {
    const before = createDefaultSave();
    const { result, save } = settleRun(before, makeConfig(), makeJob('shopper', 120), greatRun());
    expect([result.total, result.grade, result.totalBaht, result.newBest]).toEqual([8200, 'S', 212, true]);
    expect([save.baht, save.tripsCompleted, save.bestScore, save.bestGrade.rush]).toEqual([before.baht + 212, 1, 8200, 'S']);
    expect(before.tripsCompleted).toBe(0);
    expect(before.bestScore).toBe(0);
  });

  it('matching the best is not a new best; beating it is', () => {
    const first = settleRun(createDefaultSave(), makeConfig(), makeJob('shopper', 120), greatRun()).save;
    const again = settleRun(first, makeConfig(), makeJob('shopper', 120), greatRun());
    expect(again.result.newBest).toBe(false);
    expect(again.save.baht).toBe(first.baht + 212);
    const better = settleRun(first, makeConfig(), makeJob('shopper', 120), { ...greatRun(), stylePoints: 1500 });
    expect([better.result.total, better.result.newBest, better.save.bestScore]).toEqual([8500, true, 8500]);
  });

  it('a failed run pays nothing and never sets a new best, but still counts the trip', () => {
    const first = settleRun(createDefaultSave(), makeConfig(), makeJob('shopper', 120), greatRun()).save;
    const failed = settleRun(first, makeConfig(), makeJob('nervous', 120), makeStats({ failed: 'falls', falls: 3 }));
    expect([failed.result.grade, failed.result.newBest, failed.result.totalBaht]).toEqual(['F', false, 0]);
    expect([failed.save.baht, failed.save.tripsCompleted, failed.save.bestScore]).toEqual([first.baht, 2, 8200]);
  });
});
