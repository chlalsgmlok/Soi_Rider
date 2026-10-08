import type { Rng } from '../core/rng';
import type { PassengerTrait, PoiKind } from '../core/types';

/** One-line requests on the gram offer cards, flavoured by trait and (sometimes) by the destination. Content table. */

export const TRAIT_NOTES: Record<PassengerTrait, readonly string[]> = {
  hurry: [
    '회의 10분 전이에요! 레우레우(빨리빨리) 부탁해요',
    '늦으면 큰일 나요. 지름길 아시죠?',
    '열차 시간 맞춰야 해요, 제발 빨리요!',
    '지각 3번이면 잘려요… 서둘러 주세요',
    '팁 두둑이 드릴게요, 최대한 빨리!',
    '5분만 당겨 주시면 은인이에요',
  ],
  nervous: [
    '오토바이 처음이에요… 천천히 부탁해요',
    '차 사이로 너무 붙지 말아 주세요 ㅠㅠ',
    '안전 운전 해주시면 팁 드려요',
    '급브레이크 무서워요. 차차(천천히)요',
    '어제 사고 영상 봐서 겁나요… 조심히요',
  ],
  tourist: [
    '방콕 처음이에요! 사원 보이면 천천히 가 주세요',
    '사왓디! 사진 찍게 구경하면서 가요',
    '오토바이 택시 꼭 타보고 싶었어요!',
    '예쁜 거리로 돌아가도 괜찮아요',
    '태국어 하나도 몰라요… 잘 부탁해요!',
  ],
  shopper: [
    '봉지가 좀 많아요… 차 사이 조심해 주세요',
    '짐 많아요! 급커브는 살살 부탁해요',
    '과일 바구니 있어요, 흔들리면 안 돼요',
    '쇼핑백 양손 가득이에요. 폭 넓으니 조심!',
    '화분 들고 타요. 부드럽게 부탁해요',
  ],
  regular: [
    '농~ 늘 가던 데로 가 줘',
    '렉 이모 가게 단골이야, 잘 부탁해',
    '오늘은 천천히 가도 돼, 마이뺀라이',
    '지난번처럼 편하게 부탁해~',
    '싸바이싸바이~ 느긋하게 가자',
  ],
};

/** destination-flavoured notes (picked about 40% of the time when the drop kind has entries) */
export const DROP_NOTES: Partial<Record<PoiKind, readonly string[]>> = {
  bts: ['BTS 역 입구까지 부탁해요', '스카이트레인 갈아타야 해요'],
  hospital: ['병원 진료 예약 시간이 있어요', '병원 정문 앞에 내려 주세요'],
  temple: ['사원 문 닫기 전에 가야 해요', '사원 앞에서 꽃 사야 해요'],
  market: ['시장 문 닫기 전에 가야 해요', '시장 입구 쪽에 세워 주세요'],
  mall: ['몰 세일 마지막 날이에요!', '몰 정문 택시 승강장 말고 옆에요'],
  pier: ['보트 시간 맞춰야 해요', '선착장 바로 앞까지 부탁해요'],
  office: ['오피스 로비 앞에 내려 주세요', '출근 카드 찍어야 해요'],
  hotel: ['호텔 체크인 시간이에요', '호텔 로비 앞까지 부탁해요'],
  food: ['맛집 줄 서기 전에 가야 해요', '아로이 국숫집 가요!'],
  school: ['아이 하교 시간이에요', '학교 정문 앞까지요'],
  shrine: ['사당에 기도드리러 가요', '사당 앞 꽃 파는 데서 내려요'],
};

export function noteFor(rng: Rng, trait: PassengerTrait, dropKind: PoiKind): string {
  const kindNotes = DROP_NOTES[dropKind];
  const useKind = kindNotes !== undefined && trait !== 'regular' && rng.chance(0.4);
  return useKind ? rng.pick(kindNotes) : rng.pick(TRAIT_NOTES[trait]);
}
