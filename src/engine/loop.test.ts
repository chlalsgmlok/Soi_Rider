import { describe, expect, it } from 'vitest';
import { GameLoop } from './loop';
import { AutoQuality } from './quality-auto';

function rig(): { loop: GameLoop; steps: number[]; alphas: number[] } {
  const steps: number[] = [];
  const alphas: number[] = [];
  const loop = new GameLoop({ step: (dt) => steps.push(dt), render: (a) => alphas.push(a) });
  return { loop, steps, alphas };
}

describe('GameLoop (fixed 60 Hz)', () => {
  it('runs one fixed step per 60 Hz frame and reports the leftover as alpha', () => {
    const { loop, steps, alphas } = rig();
    let t = 1000;
    loop.tick(t);
    for (let i = 0; i < 60; i++) loop.tick((t += 1000 / 60));
    expect(steps.length).toBeGreaterThanOrEqual(60);
    expect(steps.length).toBeLessThanOrEqual(61);
    for (const dt of steps) expect(dt).toBeCloseTo(1 / 60, 9);
    for (const a of alphas) expect(a).toBeGreaterThanOrEqual(0);
    for (const a of alphas) expect(a).toBeLessThan(1);
  });

  it('a 30 Hz display gets two steps per frame, a 144 Hz display some frames with none', () => {
    const a = rig();
    let t = 0;
    a.loop.tick(t);
    for (let i = 0; i < 30; i++) a.loop.tick((t += 1000 / 30));
    expect(a.steps.length).toBeGreaterThanOrEqual(59);
    const b = rig();
    t = 0;
    b.loop.tick(t);
    for (let i = 0; i < 144; i++) b.loop.tick((t += 1000 / 144));
    expect(b.steps.length).toBeGreaterThanOrEqual(59);
    expect(b.steps.length).toBeLessThanOrEqual(61);
  });

  it('clamps a long hitch to at most maxSteps and drops the backlog', () => {
    const { loop, steps } = rig();
    loop.tick(0);
    steps.length = 0;
    loop.tick(2000);
    expect(steps.length).toBe(loop.maxSteps);
    expect(loop.stepsLastFrame).toBe(5);
    steps.length = 0;
    loop.tick(2000 + 1000 / 60);
    expect(steps.length).toBeLessThanOrEqual(2);
  });

  it('pause freezes simulation but keeps rendering; timeScale scales dt', () => {
    const { loop, steps, alphas } = rig();
    loop.tick(0);
    steps.length = 0;
    loop.pause();
    loop.tick(100);
    loop.tick(200);
    expect(steps.length).toBe(0);
    expect(alphas.length).toBe(3);
    loop.resume();
    loop.timeScale = 0.25;
    loop.tick(200 + 1000 / 60 + 0.01);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toBeCloseTo(0.25 / 60, 9);
  });
});

describe('AutoQuality', () => {
  const feed = (aq: AutoQuality, fps: number, seconds: number): Array<string | null> => {
    const out: Array<string | null> = [];
    for (let t = 0; t < seconds; t += 1 / fps) out.push(aq.sample(1 / fps));
    return out.filter((x) => x !== null);
  };

  it('does nothing until riding begins', () => {
    const aq = new AutoQuality('high');
    expect(feed(aq, 20, 10)).toEqual([]);
    expect(aq.preset).toBe('high');
  });

  it('steps high → medium → low while fps stays under 50, then locks', () => {
    const aq = new AutoQuality('high');
    aq.begin();
    expect(feed(aq, 30, 5)).toEqual(['medium']);
    expect(feed(aq, 30, 5)).toEqual(['low']);
    expect(aq.isLocked).toBe(true);
    expect(feed(aq, 10, 5)).toEqual([]);
  });

  it('keeps the preset when fps is fine and locks after the sampling budget', () => {
    const aq = new AutoQuality('medium', { maxSampleSec: 6 });
    aq.begin();
    expect(feed(aq, 60, 10)).toEqual([]);
    expect(aq.isLocked).toBe(true);
    expect(aq.preset).toBe('medium');
  });

  it('ignores the warm-up and tab-switch frames', () => {
    const aq = new AutoQuality('medium', { warmupSec: 2 });
    aq.begin();
    expect(aq.sample(3)).toBeNull();
    expect(feed(aq, 20, 1.9)).toEqual([]);
    expect(aq.preset).toBe('medium');
  });
});
