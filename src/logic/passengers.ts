import { PALETTE as P } from '../core/config/palette';
import type { Rng } from '../core/rng';
import type { PassengerLook, PassengerProfile, PassengerTrait } from '../core/types';

/** Passenger roster + profile rolling (docs/GAME_DESIGN.md §8). Data tables below are content, not logic. */

interface RosterEntry {
  name: string;
  female: boolean;
  /** tourists carry their own origin label and are only used for the `tourist` trait */
  touristOrigin?: string;
  skins: readonly string[];
  hairColors: readonly string[];
}

const THAI_SKINS = [P.skin2, P.skin2, P.skin3, P.skin3, P.skin4, P.skin1];
const DARK_HAIR = [P.hairBlack, P.hairBlack, P.hairBlack, P.hairBrown];

const local = (name: string, female: boolean): RosterEntry => ({ name, female, skins: THAI_SKINS, hairColors: DARK_HAIR });
const tourist = (name: string, female: boolean, origin: string, skins: string[], hair: string[]): RosterEntry => ({
  name, female, touristOrigin: origin, skins, hairColors: hair,
});

/** Thai locals (nicknames). 렉 is deliberately absent: the name belongs to 렉 이모, the stall owner of the story (§3). */
export const LOCALS: readonly RosterEntry[] = [
  local('쁠로이', true), local('솜차이', false), local('말리', true), local('아난', false), local('녹', true),
  local('폰', true), local('뱅크', false), local('비', true), local('통', false), local('핌', true),
  local('아팃', false), local('꽌', true), local('골프', false), local('노이', true), local('위차이', false),
  local('쏨잇', true),
];

export const TOURISTS: readonly RosterEntry[] = [
  tourist('켄', false, '일본 관광객', [P.skin1, P.skin2], [P.hairBlack]),
  tourist('지우', true, '한국 관광객', [P.skin1, P.skin2], [P.hairBlack, P.hairBrown]),
  tourist('사라', true, '영국 배낭여행자', [P.skin1], [P.hairBrown]),
  tourist('루카', false, '이탈리아 신혼여행', [P.skin1, P.skin2], [P.hairBrown, P.hairBlack]),
  tourist('메이', true, '대만 관광객', [P.skin1, P.skin2], [P.hairBlack]),
  tourist('톰', false, '호주 서퍼', [P.skin1, P.skin2], [P.hairBrown]),
  tourist('하나', true, '일본 미식 여행', [P.skin1], [P.hairBlack, P.hairBrown]),
  tourist('민준', false, '한국 출장', [P.skin1, P.skin2], [P.hairBlack]),
];

/** origin labels of one trait: `any` fits everyone, `female` / `male` only go to roster entries of that gender */
export interface OriginPool {
  any: readonly string[];
  female: readonly string[];
  male: readonly string[];
}

/** local origin labels per trait; `regular` is resolved by gender (단골 이모 / 단골 삼촌) */
export const LOCAL_ORIGINS: Readonly<Record<Exclude<PassengerTrait, 'tourist' | 'regular'>, OriginPool>> = {
  hurry: {
    any: ['아속 직장인', '실롬 은행원', '야간 근무 간호사', '시험 보러 가는 대학생', '면접 가는 취준생', '지각 직전 디자이너'],
    female: [],
    male: [],
  },
  nervous: {
    any: ['오토바이 택시 첫 경험', '출근길 회사원', '대학 신입생', '조심성 많은 회계사'],
    female: ['할머니 댁 가는 손녀'],
    male: ['할머니 댁 가는 손자'],
  },
  shopper: {
    any: ['짜뚜짝 쇼핑객', '시장 상인', '파티 준비 중', '도매시장 장보기', '선물 사는 직장인'],
    female: ['딸 생일상 차리는 엄마'],
    male: ['딸 생일상 차리는 아빠'],
  },
};

const SHIRTS = [P.wallMint, P.wallLemon, P.wallPowder, P.wallPink, P.taxiOrange, P.taxiBlue, P.awningRed, P.cream,
  P.leaf, P.wallSalmon, P.carWhite, P.gramCyan] as const;
const PANTS = [P.carNavy, P.carBlack, P.carBeige, P.ink, P.carSilver, P.leafDark] as const;

const ALL = [...LOCALS, ...TOURISTS];

/** true when the profile belongs to a female roster entry (selects the 카/캅 polite particle) */
export const isFemalePassenger = (p: PassengerProfile): boolean => ALL.find((e) => e.name === p.name)?.female ?? true;

function rollLook(rng: Rng, e: RosterEntry, trait: PassengerTrait): PassengerLook {
  const hairs: PassengerLook['hair'][] = e.female ? ['hair_long', 'hair_bun', 'hair_long'] : ['hair_short', 'hair_short', 'hat_cap'];
  if (trait === 'tourist') hairs.push('hat_cap');
  return {
    skin: rng.pick(e.skins),
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    hair: rng.pick(hairs),
    hairColor: rng.pick(e.hairColors),
  };
}

function originFor(rng: Rng, e: RosterEntry, trait: PassengerTrait): string {
  if (e.touristOrigin) return e.touristOrigin;
  if (trait === 'regular') return e.female ? '단골 이모' : '단골 삼촌';
  if (trait === 'tourist') return '방콕 여행 중';
  const pool = LOCAL_ORIGINS[trait];
  return rng.pick([...pool.any, ...(e.female ? pool.female : pool.male)]);
}

/**
 * Rolls a passenger for a trait. Tourists come from TOURISTS, everyone else from LOCALS. `usedNames` keeps the three
 * offers on one gram screen from showing the same person twice (the set is updated).
 */
export function rollPassenger(rng: Rng, trait: PassengerTrait, usedNames: Set<string>, idPrefix: string): PassengerProfile {
  const pool = trait === 'tourist' ? TOURISTS : LOCALS;
  const free = pool.filter((e) => !usedNames.has(e.name));
  const entry = rng.pick(free.length > 0 ? free : pool);
  usedNames.add(entry.name);
  return {
    id: `${idPrefix}-${entry.name}`,
    name: entry.name,
    origin: originFor(rng, entry, trait),
    trait,
    rating: Math.round(rng.range(4.3, 5.0) * 10) / 10,
    look: rollLook(rng, entry, trait),
  };
}
