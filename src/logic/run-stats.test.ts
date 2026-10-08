import { describe, expect, it } from 'vitest';
import {
  createRunStats, failReasonFor, finalizeStats, recordCare, recordContact, recordFall, recordLandmark, recordPedScare,
  recordRedLight, syncStyle, tickRunStats,
} from './run-stats';
import { ComfortModel } from './comfort';
import { startingComfort } from './comfort-tuning';
import { StyleTracker } from './style';

describe('run stats', () => {
  it('starts clean with comfort 80 and no care prompts', () => {
    const s = createRunStats(240, 900);
    expect(s).toMatchObject({ timeSec: 0, etaSec: 240, routeMeters: 900, falls: 0, raincoat: 'na', mask: 'na', finalComfort: 80, failed: null });
  });

  it('maps collision kinds onto counters', () => {
    const s = createRunStats();
    for (const kind of ['body', 'moto', 'static', 'mirror', 'mirror', 'curb', 'pedestrian'] as const) recordContact(s, kind);
    recordFall(s);
    recordPedScare(s);
    recordRedLight(s);
    recordLandmark(s);
    expect([s.bumps, s.mirrorClips, s.curbHits, s.pedScares, s.falls, s.redLights, s.landmarkBonus]).toEqual([3, 2, 1, 2, 1, 1, 1]);
  });

  it('accumulates time, counterflow and sidewalk seconds', () => {
    const s = createRunStats();
    for (let i = 0; i < 120; i++) tickRunStats(s, 1 / 60, { counterflow: i < 60, sidewalk: i >= 90 });
    expect(s.timeSec).toBeCloseTo(2, 9);
    expect(s.counterflowSec).toBeCloseTo(1, 9);
    expect(s.sidewalkSec).toBeCloseTo(0.5, 9);
  });

  it('never downgrades a given raincoat / mask', () => {
    const s = createRunStats();
    recordCare(s, 'raincoat', 'given');
    recordCare(s, 'raincoat', 'missed');
    recordCare(s, 'mask', 'missed');
    expect([s.raincoat, s.mask]).toEqual(['given', 'missed']);
  });

  it('copies style counters from the tracker', () => {
    const t = new StyleTracker();
    t.nearMiss(10, 30);
    t.nearMiss(10, 30);
    t.filterPass();
    const s = createRunStats();
    syncStyle(s, t);
    expect([s.nearMisses, s.perfectGaps, s.filterPasses, s.maxCombo, s.stylePoints]).toEqual([2, 0, 1, 1, 105]);
  });

  it('fails on comfort, 3 falls or more than 2.5 × ETA', () => {
    const s = createRunStats(100);
    expect(failReasonFor(s, false)).toBeNull();
    expect(failReasonFor(s, true)).toBe('comfort');
    s.timeSec = 250;
    expect(failReasonFor(s, false)).toBeNull();
    s.timeSec = 250.01;
    expect(failReasonFor(s, false)).toBe('timeout');
    const f = createRunStats(100);
    f.falls = 2;
    expect(failReasonFor(f, false)).toBeNull();
    f.falls = 3;
    expect(failReasonFor(f, false)).toBe('falls');
    f.failed = 'abandon';
    expect(failReasonFor(f, true)).toBe('abandon');
  });
});

describe('run start and finish', () => {
  it('starts at the helmet-adjusted comfort (cat ears → 85) and repairs a bad start value', () => {
    expect(createRunStats(240, 900, startingComfort('helmet_cat')).finalComfort).toBe(85);
    expect(createRunStats(240, 900, 140).finalComfort).toBe(100);
    expect(createRunStats(240, 900, Number.NaN).finalComfort).toBe(80);
  });

  it('finalizeStats copies style, final comfort and the fail reason in one call', () => {
    const t = new StyleTracker();
    t.nearMiss(10, 30);
    t.nearMiss(10, 30);
    t.filterPass();
    const s = createRunStats(100, 500, 85);
    s.timeSec = 90;
    expect(finalizeStats(s, { value: 62.5, failed: false }, t)).toBe(s);
    expect([s.finalComfort, s.failed, s.nearMisses, s.filterPasses, s.maxCombo, s.stylePoints]).toEqual([62.5, null, 2, 1, 1, 105]);

    const late = createRunStats(100, 500);
    late.timeSec = 251;
    expect(finalizeStats(late, { value: 70, failed: false }, new StyleTracker()).failed).toBe('timeout');
  });

  it('a passenger who got off ends at comfort 0 with reason comfort; an abandon set earlier wins', () => {
    const comfort = new ComfortModel('nervous', 5);
    comfort.event('fall');
    expect(comfort.failed).toBe(true);
    const s = finalizeStats(createRunStats(100), comfort, new StyleTracker());
    expect([s.finalComfort, s.failed]).toEqual([0, 'comfort']);
    const quit = createRunStats(100);
    quit.failed = 'abandon';
    expect(finalizeStats(quit, comfort, new StyleTracker()).failed).toBe('abandon');
  });

  it('keeps the previous comfort when the reading is not a number, and ignores bad time steps', () => {
    const s = createRunStats(100, 500, 85);
    expect(finalizeStats(s, { value: Number.NaN, failed: false }, new StyleTracker()).finalComfort).toBe(85);
    tickRunStats(s, Number.NaN, { counterflow: true, sidewalk: true });
    tickRunStats(s, -1, { counterflow: true, sidewalk: false });
    tickRunStats(s, Number.POSITIVE_INFINITY, { counterflow: true, sidewalk: false });
    expect([s.timeSec, s.counterflowSec, s.sidewalkSec]).toEqual([0, 0, 0]);
  });
});
