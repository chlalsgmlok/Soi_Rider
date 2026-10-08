import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { PassengerProfile, PassengerTrait } from '../core/types';
import { generateOffers } from './jobs';
import { isFemalePassenger, LOCAL_ORIGINS, LOCALS, rollPassenger, TOURISTS } from './passengers';
import { makeCity, makeCompactCity } from './testing/fixtures';

/** Korean role nouns that state the passenger's own gender */
const FEMALE_ROLE = /손녀|엄마|이모|언니|누나|아줌마|아가씨/;
const MALE_ROLE = /손자|아빠|삼촌|오빠|아저씨/;

const pools = Object.values(LOCAL_ORIGINS);
const FEMALE_ONLY = new Set([...pools.flatMap((p) => p.female), '단골 이모']);
const MALE_ONLY = new Set([...pools.flatMap((p) => p.male), '단골 삼촌']);

/** every passenger of 400 seeds × 3 offers on both test maps, plus 600 direct rolls per trait */
function sampleProfiles(): PassengerProfile[] {
  const out: PassengerProfile[] = [];
  for (const city of [makeCompactCity(), makeCity()]) {
    for (let seed = 0; seed < 400; seed++) {
      for (const o of generateOffers(city, new Rng(seed), 'rush', 1 + (seed % 5))) out.push(o.passenger);
    }
  }
  for (const trait of ['hurry', 'nervous', 'shopper', 'regular', 'tourist'] as PassengerTrait[]) {
    const rng = new Rng(77);
    for (let i = 0; i < 600; i++) out.push(rollPassenger(rng, trait, new Set(), `t${i}`));
  }
  return out;
}

describe('passenger origins follow the roster gender', () => {
  const profiles = sampleProfiles();
  const men = profiles.filter((p) => !isFemalePassenger(p));
  const women = profiles.filter((p) => isFemalePassenger(p));

  it('no male passenger ever gets a female origin (e.g. 할머니 댁 가는 손녀)', () => {
    expect(men.length).toBeGreaterThan(1000);
    const wrong = men.filter((p) => FEMALE_ROLE.test(p.origin) || FEMALE_ONLY.has(p.origin)).map((p) => `${p.name}: ${p.origin}`);
    expect(wrong).toEqual([]);
  });

  it('no female passenger ever gets a male origin', () => {
    expect(women.length).toBeGreaterThan(1000);
    const wrong = women.filter((p) => MALE_ROLE.test(p.origin) || MALE_ONLY.has(p.origin)).map((p) => `${p.name}: ${p.origin}`);
    expect(wrong).toEqual([]);
  });

  it('gendered labels are still used, each by the matching gender', () => {
    const menOrigins = new Set(men.map((p) => p.origin));
    const womenOrigins = new Set(women.map((p) => p.origin));
    for (const label of ['할머니 댁 가는 손자', '딸 생일상 차리는 아빠', '단골 삼촌']) expect(menOrigins).toContain(label);
    for (const label of ['할머니 댁 가는 손녀', '딸 생일상 차리는 엄마', '단골 이모']) expect(womenOrigins).toContain(label);
    /* the reviewer's male examples now draw nervous origins from the male-safe pool */
    const nervousMen = men.filter((p) => p.trait === 'nervous' && ['통', '골프', '아난', '위차이'].includes(p.name));
    expect(nervousMen.length).toBeGreaterThan(20);
    expect(nervousMen.some((p) => p.origin === '할머니 댁 가는 손자')).toBe(true);
  });

  it('the origin tables put every gendered label on its own side', () => {
    for (const pool of pools) {
      for (const label of pool.any) {
        expect(label).not.toMatch(FEMALE_ROLE);
        expect(label).not.toMatch(MALE_ROLE);
      }
      for (const label of pool.female) expect(label).not.toMatch(MALE_ROLE);
      for (const label of pool.male) expect(label).not.toMatch(FEMALE_ROLE);
    }
  });
});

describe('roster', () => {
  it('has unique names (gender lookup is by name) and never uses 렉, the story NPC', () => {
    const names = [...LOCALS, ...TOURISTS].map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain('렉');
  });

  it('keeps both genders well represented among locals and tourists', () => {
    for (const roster of [LOCALS, TOURISTS]) {
      const female = roster.filter((e) => e.female).length;
      expect(female).toBeGreaterThanOrEqual(roster.length / 2 - 1);
      expect(roster.length - female).toBeGreaterThanOrEqual(roster.length / 2 - 1);
    }
  });
});
