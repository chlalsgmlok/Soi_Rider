import { describe, expect, it } from 'vitest';
import { SITUATIONS } from './dialogue';
import { SPEECH_GAP, SPEECH_RULES, SpeechGate } from './speech-gate';

describe('SpeechGate', () => {
  it('has a rule for every dialogue situation', () => {
    expect(Object.keys(SPEECH_RULES).sort()).toEqual([...SITUATIONS].sort());
    expect(SPEECH_GAP).toBe(2.5);
  });

  it('voices greet / board / arrival once per ride', () => {
    const g = new SpeechGate();
    expect(g.allow('greet', 0)).toBe(true);
    expect(g.allow('greet', 500)).toBe(false);
    expect(g.allow('board', 0.5)).toBe(true);
    expect(g.allow('arriveGood', 300)).toBe(true);
    expect(g.allow('arriveGood', 301)).toBe(false);
  });

  it('ambient remarks wait 2.5 s after any line, then their own cooldown', () => {
    const g = new SpeechGate();
    g.allow('greet', 0);
    expect(g.allow('nearMiss', 2.4)).toBe(false);
    expect(g.allow('nearMiss', 2.5)).toBe(true);
    expect(g.allow('nearMiss', 9.4)).toBe(false);
    expect(g.allow('nearMiss', 9.5)).toBe(true);
    expect(g.allow('harshBrake', 10)).toBe(false);
    expect(g.allow('harshBrake', 12)).toBe(true);
  });

  it('story beats cut through the gap but respect their own cooldown', () => {
    const g = new SpeechGate();
    g.allow('nearMiss', 10);
    expect(g.allow('crash', 10.2)).toBe(true);
    expect(g.allow('crash', 14.1)).toBe(false);
    expect(g.allow('crash', 14.2)).toBe(true);
    expect(g.allow('fall', 14.3)).toBe(true);
    expect(g.allow('nearMiss', 16)).toBe(false);
  });

  it('canSay has no side effects; reset forgets everything', () => {
    const g = new SpeechGate();
    expect(g.canSay('smooth', 20)).toBe(true);
    expect(g.canSay('smooth', 20)).toBe(true);
    expect(g.allow('smooth', 20)).toBe(true);
    expect(g.canSay('smooth', 54)).toBe(false);
    expect(g.canSay('smooth', 55)).toBe(true);
    g.allow('greet', 21);
    g.reset();
    expect(g.allow('greet', 0)).toBe(true);
  });
});
