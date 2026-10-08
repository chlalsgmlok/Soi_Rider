import { describe, expect, it } from 'vitest';
import { createDefaultSave, createRunConfig, DISTRICT_LABEL } from '../logic';
import { readParams } from './params';
import { forecastFor, rerolled, runConfigFor } from './run-plan';

const save = createDefaultSave();

describe('run plan (Setup → RunConfig with QA overrides)', () => {
  it('pins district, time of day and sky from the URL, with a matching label and summary', () => {
    const p = readParams('?seed=9&district=yaowarat&tod=night&weather=haze');
    const f = forecastFor(save, p, 'rush');
    expect(f.seed).toBe(9);
    expect(f.tripNumber).toBe(1);
    expect(f.district).toBe('yaowarat');
    expect(f.districtLabel).toBe(DISTRICT_LABEL.yaowarat);
    expect(f.timeOfDay).toBe('night');
    expect(f.weather.base).toBe('haze');
    expect(f.weather.haze).toBeGreaterThan(0.3);
    expect(f.summary).toContain('밤');
  });

  it('is deterministic for a seed and rolls the weather events for the chosen intensity', () => {
    const p = readParams('?seed=1234');
    const f = forecastFor(save, p, 'gridlock');
    expect(forecastFor(save, p, 'gridlock')).toEqual(f);
    expect(runConfigFor(f, 'gridlock', save.loadout, p)).toEqual(createRunConfig(f, 'gridlock', save.loadout));
  });

  it('scripts the weather for ?weather=storm|smog|calm', () => {
    const storm = readParams('?seed=5&weather=storm');
    const sc = runConfigFor(forecastFor(save, storm, 'rush'), 'rush', save.loadout, storm);
    expect(sc.weather.base).toBe('overcast');
    expect(sc.weather.events).toEqual([{ kind: 'downpour', atProgress: 0.2, duration: 80, intensity: 0.9 }]);
    const smog = readParams('?seed=5&weather=smog');
    expect(runConfigFor(forecastFor(save, smog, 'rush'), 'rush', save.loadout, smog).weather.events.map((e) => e.kind)).toEqual(['haze_spike']);
    const calm = readParams('?seed=5&weather=calm');
    expect(runConfigFor(forecastFor(save, calm, 'rush'), 'rush', save.loadout, calm).weather.events).toEqual([]);
  });

  it('keeps URL overrides through a reroll and allows only the free one', () => {
    const p = readParams('?seed=77&district=siam');
    const first = forecastFor(save, p, 'rush');
    const next = rerolled(first, p, 'rush');
    expect(next).not.toBeNull();
    expect(next?.district).toBe('siam');
    expect(next?.rerollsLeft).toBe(0);
    expect(next && rerolled(next, p, 'rush')).toBeNull();
  });
});
