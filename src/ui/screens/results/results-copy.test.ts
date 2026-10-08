import { describe, expect, it } from 'vitest';
import type { FailReason, RunStats } from '../../../core/types/game';
import { createDefaultSave } from '../../../logic/save-defaults';
import { createRunStats } from '../../../logic/run-stats';
import { settleRun } from '../../../logic/settle-run';
import { STARTER_LOADOUT } from '../../../core/config/catalog';
import { DEMO_OFFERS } from '../intro/intro-demo';
import { FAIL_COPY, headline, passengerMood, receiptMeta, tipDetail } from './results-copy';
import { demoResultsProps } from './results-demo';

function run(over: Partial<RunStats>, trait = 0) {
  const job = DEMO_OFFERS[trait];
  const stats: RunStats = { ...createRunStats(200, job.estMeters, 80), ...over };
  const config = { seed: 7, tripNumber: 3, intensity: 'rush' as const, timeOfDay: 'sunset' as const, weather: { base: 'clear' as const, haze: 0, events: [] }, district: 'sukhumvit' as const, loadout: { ...STARTER_LOADOUT } };
  return settleRun(createDefaultSave(), config, job, stats).result;
}

describe('results copy', () => {
  it('headlines a great run by grade and names the passenger', () => {
    const r = run({ timeSec: 128, finalComfort: 96, stylePoints: 1460, raincoat: 'given', smoothArrival: true });
    expect(r.grade).toBe('S');
    const h = headline(r);
    expect(h.title + h.accent).toBe('PERFECTRIDE!');
    expect(h.sub).toContain(r.job.passenger.name);
    expect(passengerMood(r)).toBe('happy');
    expect(tipDetail(r)).toBe('S 등급 팁 · 우비');
  });

  it('explains every fail reason in Korean and pays nothing', () => {
    const reasons: FailReason[] = ['comfort', 'falls', 'timeout', 'abandon'];
    for (const fail of reasons) {
      const r = run({ timeSec: 140, finalComfort: fail === 'comfort' ? 0 : 40, failed: fail });
      expect(r.grade).toBe('F');
      expect(r.totalBaht).toBe(0);
      expect(headline(r)).toMatchObject({ title: 'TRIP', accent: 'FAILED', sub: FAIL_COPY[fail].sub });
      expect(tipDetail(r)).toBe('결제 취소');
    }
    expect(FAIL_COPY.comfort.title).toBe('손님이 내려버렸어요');
    expect(FAIL_COPY.falls.title).toBe('넘어짐 3회');
    expect(FAIL_COPY.timeout.title).toBe('시간 초과');
    expect(passengerMood(run({ failed: 'falls', falls: 3 }))).toBe('scared');
  });

  it('prints trip, district, intensity and ride time on the receipt head', () => {
    expect(receiptMeta(run({ timeSec: 178 }))).toEqual(['TRIP 03 · 수쿰빗', '러시아워 · 운행 02:58']);
  });
});

describe('results sandbox data', () => {
  it('lands every demo profile on its labelled grade, and fails pay ฿0', () => {
    const on = { next: () => undefined, garage: () => undefined, title: () => undefined };
    for (const grade of ['S', 'A', 'B', 'C', 'D'] as const) {
      const p = demoResultsProps({ grade, fail: null, best: true, on });
      expect(p.result.grade).toBe(grade);
      expect(p.save.baht).toBe(420 + p.result.totalBaht);
    }
    expect(demoResultsProps({ grade: 'A', fail: 'timeout', best: true, on }).result.totalBaht).toBe(0);
  });
});
