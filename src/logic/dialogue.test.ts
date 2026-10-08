import { describe, expect, it } from 'vitest';
import type { Mood } from '../core/events';
import { Rng } from '../core/rng';
import type { PassengerTrait } from '../core/types';
import { FAIL_COMMENTS, GRADE_COMMENTS } from './comments';
import { Chatter, say, SITUATIONS } from './dialogue';
import { LINES } from './dialogue-lines';

const TRAITS: PassengerTrait[] = ['hurry', 'nervous', 'tourist', 'shopper', 'regular'];
const MOODS: Mood[] = ['happy', 'neutral', 'scared', 'angry', 'wet', 'cough'];

describe('dialogue content', () => {
  it('covers all 21 situations with at least 4 base variants each', () => {
    expect(SITUATIONS).toHaveLength(22);
    for (const sit of ['greet', 'board', 'nearMiss', 'crash', 'fall', 'harshBrake', 'smooth', 'rainStart', 'raincoatGiven',
      'raincoatMissed', 'haze', 'maskGiven', 'slowTraffic', 'counterflow', 'sidewalk', 'landmark', 'arriveGood', 'arriveBad',
      'hurry', 'heat', 'waiting'] as const) {
      expect(LINES[sit].base.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('renders every line without leftover placeholders and with a valid mood', () => {
    for (const sit of SITUATIONS) {
      for (const trait of TRAITS) {
        for (let seed = 0; seed < 25; seed++) {
          const line = say(new Rng(seed), sit, trait, { female: seed % 2 === 0, place: '왓 아룬' });
          expect(line.text.length).toBeGreaterThan(2);
          expect(line.text).not.toMatch(/[{}]/);
          expect(MOODS).toContain(line.mood);
        }
      }
    }
  });

  it('uses 카 for women and 캅 for men', () => {
    const female = new Set<string>();
    const male = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      female.add(say(new Rng(seed), 'raincoatGiven', 'shopper', { female: true }).text);
      male.add(say(new Rng(seed), 'raincoatGiven', 'shopper', { female: false }).text);
    }
    expect([...female].some((t) => t.includes('컵쿤카'))).toBe(true);
    expect([...female].some((t) => t.includes('컵쿤캅'))).toBe(false);
    expect([...male].some((t) => t.includes('컵쿤캅'))).toBe(true);
    expect([...male].some((t) => t.includes('컵쿤카'))).toBe(false);
  });

  it('fills the landmark name', () => {
    const texts = new Set<string>();
    for (let seed = 0; seed < 100; seed++) texts.add(say(new Rng(seed), 'landmark', 'tourist', { place: '왓 아룬' }).text);
    expect([...texts].every((t) => t.includes('왓 아룬'))).toBe(true);
    expect(say(new Rng(1), 'landmark', 'shopper').text).toMatch(/저기/);
  });

  it('tone follows the trait: hurry enjoys near misses, nervous never does', () => {
    const moods = (trait: PassengerTrait) => {
      const out: Mood[] = [];
      for (let seed = 0; seed < 400; seed++) out.push(say(new Rng(seed), 'nearMiss', trait).mood);
      return out;
    };
    const hurryHappy = moods('hurry').filter((m) => m === 'happy').length / 400;
    expect(hurryHappy).toBeGreaterThan(0.45);
    expect(hurryHappy).toBeLessThan(0.75);
    expect(moods('nervous').filter((m) => m === 'happy')).toHaveLength(0);
  });

  it('is deterministic for a given rng', () => {
    expect(say(new Rng(5), 'greet', 'regular')).toEqual(say(new Rng(5), 'greet', 'regular'));
  });
});

describe('Chatter', () => {
  it('plays every variant once before repeating, and never repeats back-to-back', () => {
    const c = new Chatter(new Rng(11), 'nervous', { female: true });
    const pool = LINES.nearMiss.base.length + (LINES.nearMiss.trait?.nervous?.length ?? 0);
    const first = Array.from({ length: pool }, () => c.say('nearMiss').text);
    expect(new Set(first).size).toBe(pool);
    let prev = first[first.length - 1];
    for (let i = 0; i < pool * 4; i++) {
      const next = c.say('nearMiss').text;
      expect(next).not.toBe(prev);
      prev = next;
    }
  });

  it('accepts a per-call landmark name', () => {
    const c = new Chatter(new Rng(3), 'tourist', { female: false });
    expect(c.say('landmark', '짐 톰슨 하우스').text).toContain('짐 톰슨 하우스');
  });
});

describe('gendered self-reference (이모 / 삼촌)', () => {
  /** every rendered regular line, all variants of every situation (a Chatter plays each variant once per round) */
  const everyRegularLine = (female: boolean): string[] => {
    const c = new Chatter(new Rng(7), 'regular', { female, place: '왓 포' });
    const out: string[] = [];
    for (const sit of SITUATIONS) {
      const variants = LINES[sit].base.length + (LINES[sit].trait?.regular?.length ?? 0);
      for (let i = 0; i < variants; i++) out.push(c.say(sit).text);
    }
    return out;
  };
  /** 이모 other than "렉 이모" (the stall owner, always third person) */
  const selfImo = (t: string): boolean => t.replaceAll('렉 이모', '').includes('이모');

  it('a male regular calls himself 삼촌 and never 이모', () => {
    const lines = everyRegularLine(false);
    expect(lines.filter(selfImo)).toEqual([]);
    for (const t of ['농! 삼촌 심장 약해~', '천천히 와~ 삼촌 커피 마시는 중', '어이쿠, 삼촌 허리 생각해 줘~',
      '삼촌 빨래 널어놨는데…', '삼촌 드라마 시작한다~ 서둘러~', '이 정도 더위쯤이야~ 삼촌 끄떡없어']) {
      expect(lines).toContain(t);
    }
    expect(lines).toContain('사왓디 농! 렉 이모는 잘 계시지?');
    for (const sit of SITUATIONS) {
      for (let seed = 0; seed < 60; seed++) expect(selfImo(say(new Rng(seed), sit, 'regular', { female: false }).text)).toBe(false);
    }
  });

  it('a female regular calls herself 이모 and never 삼촌', () => {
    const lines = everyRegularLine(true);
    expect(lines.filter((t) => t.includes('삼촌'))).toEqual([]);
    expect(lines).toContain('농! 이모 심장 약해~');
    expect(lines).toContain('천천히 와~ 이모 커피 마시는 중');
  });

  it('no content table hard-codes a gendered self-reference (they use {imo})', () => {
    const dialogue = Object.values(LINES).flatMap((p) =>
      [...p.base, ...Object.values(p.trait ?? {}).flatMap((l) => l ?? [])].map(([t]) => t));
    const comments = [...Object.values(GRADE_COMMENTS).flatMap((p) =>
      [...p.base, ...Object.values(p.trait ?? {}).flatMap((l) => l ?? [])]), ...Object.values(FAIL_COMMENTS).flat()];
    expect(dialogue.length).toBeGreaterThan(200);
    expect([...dialogue, ...comments].filter((t) => t.includes('삼촌') || selfImo(t))).toEqual([]);
  });
});
