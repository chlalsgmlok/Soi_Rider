import type { Rng } from '../core/rng';
import type { FailReason, Grade, PassengerTrait } from '../core/types';

/** Passenger review lines on the gram receipt, by grade and trait. Content table; `{kha}` → 카 / 캅. */

type Pool = { base: readonly string[]; trait?: Partial<Record<PassengerTrait, readonly string[]>> };

export const GRADE_COMMENTS: Record<Exclude<Grade, 'F'>, Pool> = {
  S: {
    base: ['최고의 라이더! 다음에도 꼭 불러야지. 컵쿤{kha}!', '방콕에서 탄 오토바이 중 제일 편했어요!', '완벽해요! 별 다섯 개로도 모자라요'],
    trait: {
      hurry: ['기적이에요! 회의 시간 딱 맞췄어요. 컵쿤{kha}!!', '이 속도에 이 안정감이라니… 레전드!'],
      nervous: ['하나도 안 무서웠어요. 다음에도 꼭 이 기사님!', '싸바이싸바이~ 오토바이가 이렇게 편할 수 있다니'],
      tourist: ['인생 라이드! 여행 영상 하이라이트예요!', '방콕 여행 최고의 순간이었어요. 컵쿤{kha}… 맞죠?'],
      shopper: ['봉지 하나 안 떨어졌어요! 계란도 멀쩡해요', '짐 많은데 이렇게 부드럽게! 최고예요'],
      regular: ['역시 우리 농이야! 렉 이모한테 자랑해야지', '마이뺀라이가 아니라 완벽 그 자체야~'],
    },
  },
  A: {
    base: ['아주 좋았어요! 또 탈게요', '빠르고 안전했어요. 컵쿤{kha}~', '실력 좋으시네요! 추천할게요'],
    trait: {
      hurry: ['덕분에 거의 안 늦었어요. 감사해요!', '빠르다! 다음에도 급할 때 부를게요'],
      nervous: ['처음엔 무서웠는데 금방 편해졌어요', '조심히 달려줘서 고마워요'],
      tourist: ['재밌었어요! 방콕 거리 구경 잘했어요', '사진 많이 찍었어요. 컵쿤{kha}!'],
      shopper: ['짐 무사해요! 고마워요~', '바구니 안 흔들려서 좋았어요'],
      regular: ['오늘도 수고했어, 농~', '역시 단골은 단골 기사지!'],
    },
  },
  B: {
    base: ['괜찮았어요. 무난한 라이드', '조금 아슬했지만 잘 도착했네요', '나쁘지 않았어요. 컵쿤{kha}'],
    trait: {
      hurry: ['조금만 더 빨랐으면 좋았을 텐데…', '간신히 맞췄어요. 휴'],
      nervous: ['몇 번 심장이 철렁했어요…', '다음엔 조금 더 천천히 부탁해요'],
      tourist: ['나름 스릴 있었어요! 방콕 교통 대단하네요', '재밌었는데 조금 무서웠어요'],
      shopper: ['봉지 하나 찌그러졌지만… 괜찮아요', '짐이 좀 흔들렸어요'],
      regular: ['마이뺀라이, 오늘은 길이 막혔지', '다음엔 더 잘하자, 농!'],
    },
  },
  C: {
    base: ['도착은 했네요…', '조금 거칠었어요', '다음엔 더 조심해 주세요'],
    trait: {
      hurry: ['결국 늦었어요. 다음엔 다른 기사님 부를래요', '이 속도면 걸어가는 게…'],
      nervous: ['다리가 아직도 떨려요…', '너무 무서웠어요, 짜이옌옌 좀 해주세요'],
      tourist: ['방콕 교통… 무섭다는 말이 사실이었네요', '스릴은 확실했어요… 너무 확실했어요'],
      shopper: ['과일 몇 개 깨졌어요…', '쇼핑백 하나 찢어졌어요'],
      regular: ['오늘 컨디션 안 좋니? 짜이옌옌~', '렉 이모한테 이른다~'],
    },
  },
  D: {
    base: ['다시는 안 탈래요', '별 하나도 아까워요', '운전 연습 좀 하세요…'],
    trait: {
      hurry: ['늦었어요. 완전히 늦었어요', '택시 탈 걸 그랬어요'],
      nervous: ['오늘 꿈에 나올 것 같아요…', '심장이 멎는 줄 알았어요'],
      tourist: ['여행 후기에 꼭 쓸게요. 나쁜 쪽으로요', '방콕 첫날부터… 휴'],
      shopper: ['장 본 거 반은 망가졌어요', '봉지 다시 사야겠어요'],
      regular: ['농, 이건 아니지…', '단골 다시 생각해 봐야겠다'],
    },
  },
};

export const FAIL_COMMENTS: Record<FailReason, readonly string[]> = {
  comfort: ['여기서 내릴게요. 더는 못 타겠어요', '세워 주세요! 걸어갈래요', '무서워서 못 타요. 그냥 내릴게요'],
  falls: ['괜찮아요? …저는 다른 오토바이 탈게요', '세 번이나 넘어지다니… 여기서 내릴게요', '오늘은 운이 없네요. 다음에 봐요'],
  timeout: ['너무 늦어서 콜 취소했어요', '기다리다 지쳐서 다른 차 탔어요', '시간이 너무 지났어요. 취소할게요'],
  abandon: ['기사님 어디 가요?! 콜 취소됐네요', '갑자기 운행 종료라니…', '다른 기사님 부를게요'],
};

/** trait-specific lines are preferred (2 of 3 picks) when the pool has them */
export function passengerComment(rng: Rng, grade: Grade, trait: PassengerTrait, fail: FailReason | null, female: boolean): string {
  const kha = female ? '카' : '캅';
  if (grade === 'F' || fail) return rng.pick(FAIL_COMMENTS[fail ?? 'abandon']).replaceAll('{kha}', kha);
  const pool = GRADE_COMMENTS[grade];
  const traitLines = pool.trait?.[trait];
  const lines = traitLines && rng.chance(2 / 3) ? traitLines : pool.base;
  return rng.pick(lines).replaceAll('{kha}', kha);
}
