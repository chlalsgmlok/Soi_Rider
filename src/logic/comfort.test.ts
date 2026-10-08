import { describe, expect, it } from 'vitest';
import { ComfortModel } from './comfort';
import { CAT_HELMET_COMFORT, startingComfort, type ComfortDelta, type ComfortTickInput } from './comfort-tuning';

const DT = 1 / 60;
const calm: ComfortTickInput = {
  speed: 8, accel: 0, counterflow: false, sidewalk: false, rainingNoPoncho: false, smogNoMask: false, heatStoppedUnshaded: false,
};

/** runs `seconds` of fixed 60 Hz ticks, collecting everything reported */
function run(m: ComfortModel, seconds: number, input: Partial<ComfortTickInput> = {}): ComfortDelta[] {
  const out: ComfortDelta[] = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) out.push(...m.tick(DT, { ...calm, ...input }));
  return out;
}

describe('ComfortModel events', () => {
  it('starts at 80 (85 with the cat helmet)', () => {
    expect(new ComfortModel('shopper').value).toBe(80);
    expect(startingComfort('helmet_cat')).toBe(80 + CAT_HELMET_COMFORT);
    expect(startingComfort('helmet_full')).toBe(80);
    expect(new ComfortModel('shopper', 140).value).toBe(100);
  });

  it('scales frights by trait: near miss −1.5 × (hurry .5, nervous 2, regular .7)', () => {
    const delta = (trait: ConstructorParameters<typeof ComfortModel>[0]) => new ComfortModel(trait).event('nearMiss')?.delta;
    expect(delta('shopper')).toBeCloseTo(-1.5, 9);
    expect(delta('hurry')).toBeCloseTo(-0.75, 9);
    expect(delta('nervous')).toBeCloseTo(-3, 9);
    expect(delta('regular')).toBeCloseTo(-1.05, 9);
    expect(new ComfortModel('nervous').event('mirror')?.delta).toBeCloseTo(-8, 9);
  });

  it('body hits and falls are not scaled; gifts add 12 up to 100', () => {
    const m = new ComfortModel('nervous');
    expect(m.event('body')).toEqual({ cause: 'body', delta: -10, reason: '차량 충돌', value: 70 });
    expect(m.event('fall')?.delta).toBe(-25);
    expect(m.event('raincoat')).toEqual({ cause: 'raincoat', delta: 12, reason: '우비 건넴', value: 57 });
    const full = new ComfortModel('regular', 95);
    expect(full.event('mask')?.delta).toBe(5);
    expect(full.event('mask')).toBeNull();
  });

  it('fails at 0 and then ignores everything', () => {
    const m = new ComfortModel('shopper');
    for (let i = 0; i < 7; i++) m.event('body');
    expect(m.value).toBe(10);
    expect(m.failed).toBe(false);
    expect(m.event('body')).toEqual({ cause: 'body', delta: -10, reason: '차량 충돌', value: 0 });
    expect(m.failed).toBe(true);
    expect(m.event('raincoat')).toBeNull();
    expect(m.tick(DT, { ...calm, counterflow: true })).toHaveLength(0);
    expect(m.value).toBe(0);
  });
});

describe('ComfortModel continuous effects', () => {
  it('drains per second and reports once per second with a Korean reason', () => {
    const m = new ComfortModel('shopper');
    const out = run(m, 1, { counterflow: true });
    expect(m.value).toBeCloseTo(80 - 0.8, 6);
    expect(out).toHaveLength(1);
    expect(out[0].cause).toBe('counterflow');
    expect(out[0].reason).toBe('역주행');
    expect(out[0].delta).toBeCloseTo(-0.8, 6);
  });

  it('applies sidewalk −0.6, rain −0.5, smog −0.4 per second', () => {
    const cases: Array<[Partial<ComfortTickInput>, number]> = [
      [{ sidewalk: true }, -0.6], [{ rainingNoPoncho: true }, -0.5], [{ smogNoMask: true }, -0.4],
    ];
    for (const [input, perSec] of cases) {
      const m = new ComfortModel('tourist');
      run(m, 2, input);
      expect(m.value).toBeCloseTo(80 + 2 * perSec, 6);
    }
  });

  it('heat: −0.3/s only after 5 s stopped in the sun, with no recovery meanwhile', () => {
    const m = new ComfortModel('tourist');
    const sun = { heatStoppedUnshaded: true, speed: 0 };
    expect(run(m, 4.9, sun)).toHaveLength(0);
    expect(m.value).toBe(80);
    const out = run(m, 2.1, sun);
    expect(Math.abs(m.value - 79.4)).toBeLessThan(0.011);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.cause === 'heat')).toBe(true);
    expect(out[0].reason).toBe('땡볕 정차');
  });

  it('heat: rolling (≥ 1 m/s) is exempt and any movement restarts the 5 s grace', () => {
    const rolling = new ComfortModel('tourist');
    const out = run(rolling, 10, { heatStoppedUnshaded: true, speed: 3 });
    expect(out.some((d) => d.cause === 'heat')).toBe(false);
    expect(rolling.value).toBeGreaterThan(80);
    const m = new ComfortModel('tourist');
    run(m, 4, { heatStoppedUnshaded: true, speed: 0 });
    run(m, 0.5, { speed: 2 });
    run(m, 4, { heatStoppedUnshaded: true, speed: 0.4 });
    expect(m.value).toBe(80);
  });

  it('sharp turns drain −0.5/s scaled by turnMult (shopper ×1.5)', () => {
    const m = new ComfortModel('shopper');
    run(m, 2, { lateralAccel: 5 });
    expect(m.value).toBeCloseTo(80 - 2 * 0.5 * 1.5, 6);
  });

  it('counterflow for 100 s ends the ride', () => {
    const m = new ComfortModel('shopper');
    const out = run(m, 101, { counterflow: true });
    expect(m.failed).toBe(true);
    expect(m.value).toBe(0);
    expect(out[out.length - 1].value).toBe(0);
  });

  it('recovers smoothly: nothing for 2 s of calm, ramps to +0.15/s by 4 s', () => {
    const m = new ComfortModel('shopper');
    run(m, 2);
    expect(m.value).toBeCloseTo(80, 3);
    run(m, 2);
    /* the smoothstep ramp over 2..4 s integrates to 1 s of full rate */
    expect(m.value).toBeCloseTo(80 + 0.15, 2);
    run(m, 6);
    expect(m.value).toBeCloseTo(80 + 0.15 * 7, 2);
  });

  it('recovery never exceeds 100 and any upset restarts the calm timer', () => {
    const top = new ComfortModel('shopper', 99.9);
    run(top, 20);
    expect(top.value).toBe(100);
    const m = new ComfortModel('shopper');
    run(m, 3.9);
    m.event('nearMiss');
    const before = m.value;
    run(m, 1.9);
    expect(m.value).toBeCloseTo(before, 6);
    const bumpy = new ComfortModel('shopper');
    run(bumpy, 10, { accel: 3.5 });
    expect(bumpy.value).toBe(80);
  });
});

describe('harsh braking', () => {
  it('counts once per braking episode (> 6 m/s²), re-armed when braking eases above −3', () => {
    const m = new ComfortModel('nervous');
    const first = m.tick(DT, { ...calm, accel: -7 });
    expect(first).toEqual([{ cause: 'harshBrake', delta: -6, reason: '급제동', value: 74 }]);
    expect(run(m, 0.5, { accel: -7 }).filter((d) => d.cause === 'harshBrake')).toHaveLength(0);
    run(m, 0.1, { accel: -4 });
    expect(m.tick(DT, { ...calm, accel: -7 })).toHaveLength(0);
    run(m, 0.1, { accel: -1 });
    expect(m.tick(DT, { ...calm, accel: -6 })).toHaveLength(0);
    expect(m.tick(DT, { ...calm, accel: -6.5 })[0]?.delta).toBe(-6);
  });

  it('is ignored right after a crash (the impact already hurt)', () => {
    const m = new ComfortModel('shopper');
    m.event('body');
    run(m, 0.3, { accel: -9 });
    expect(m.value).toBeCloseTo(70, 6);
    run(m, 0.1, { accel: 0 });
    run(m, 0.5);
    expect(m.tick(DT, { ...calm, accel: -9 })[0]?.delta).toBe(-3);
  });
});
