/** Sandbox data for the Intro screen (sandbox/ui-play.html?view=intro). Not used by the game. */
import type { IntroProps } from '../../../core/types/screens';
import type { JobOffer, TimeOfDay } from '../../../core/types/game';
import { PALETTE as P } from '../../../core/config/palette';

const POI: Record<number, string> = {
  11: 'Soi 23 카오만까이',
  12: '터미널 21 · 아속',
  21: 'BTS 프롬퐁역',
  22: '벤자낏띠 공원',
  31: 'Soi 31 세븐일레븐',
  32: '엠포리움 백화점',
};

export const DEMO_OFFERS: JobOffer[] = [
  {
    id: 'demo-mali',
    passenger: { id: 'p-mali', name: '말리', origin: '아속 직장인', trait: 'hurry', rating: 4.8, look: { skin: P.skin2, shirt: P.taxiPink, pants: P.carNavy, hair: 'hair_long', hairColor: P.hairBlack } },
    pickupPoi: 11,
    dropPoi: 12,
    estMeters: 1240,
    approachMeters: 320,
    fareBaht: 139,
    note: '9시 회의예요! 최대한 빨리 부탁해요.',
  },
  {
    id: 'demo-ken',
    passenger: { id: 'p-ken', name: '켄', origin: '일본 관광객', trait: 'tourist', rating: 4.9, look: { skin: P.skin1, shirt: P.wallPowder, pants: P.carBeige, hair: 'hat_cap', hairColor: P.taxiRed } },
    pickupPoi: 21,
    dropPoi: 22,
    estMeters: 860,
    approachMeters: 610,
    fareBaht: 118,
    note: '가는 길에 예쁜 곳 있으면 천천히 지나가 주세요!',
  },
  {
    id: 'demo-ploy',
    passenger: { id: 'p-ploy', name: '쁠로이', origin: '할머니 댁 가는 손녀', trait: 'nervous', rating: 4.6, look: { skin: P.skin3, shirt: P.wallMint, pants: P.carNavy, hair: 'hair_bun', hairColor: P.hairBlack } },
    pickupPoi: 31,
    dropPoi: 32,
    estMeters: 640,
    approachMeters: 180,
    fareBaht: 97,
    note: '오토바이는 처음이라… 살살 가 주세요.',
  },
];

export function demoIntroProps(o: { secs: number; tod: TimeOfDay; rain: boolean; trip: number; onAccept(id: string): void }): IntroProps {
  return {
    tripNumber: o.trip,
    nickname: 'NONG',
    districtLabel: '수쿰빗',
    timeOfDay: o.tod,
    weather: { base: 'clear', haze: 0.15, events: o.rain ? [{ kind: 'downpour', atProgress: 0.45, duration: 90, intensity: 0.8 }] : [] },
    offers: DEMO_OFFERS,
    poiName: (id) => POI[id] ?? `POI ${id}`,
    secondsToChoose: o.secs,
    onAccept: o.onAccept,
  };
}
