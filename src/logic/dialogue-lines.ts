import type { Mood } from '../core/events';
import type { PassengerTrait } from '../core/types';

/**
 * Passenger speech bubbles (content table). Korean with Thai flavour:
 * 사왓디 (hello) · 컵쿤 (thanks) · {kha} polite particle 카/캅 · 짜이옌옌 (calm down) · 레우레우 (hurry) ·
 * 마이뺀라이 (never mind) · 싸바이 (comfy) · 떡짜이 (startled) · 폰똑 (it's raining) · 롯띳 (traffic jam) · 론막 (so hot) ·
 * 차차 (slowly) · 아로이 (tasty). Placeholders: {kha}, {imo} (a regular speaking of themself: 이모 / 삼촌), {place}
 * (landmark name). Third-person '렉 이모' (the stall owner) is literal and never a placeholder.
 */
export type Situation =
  | 'greet' | 'board' | 'nearMiss' | 'crash' | 'fall' | 'harshBrake' | 'smooth' | 'rainStart' | 'raincoatGiven'
  | 'raincoatMissed' | 'haze' | 'maskGiven' | 'slowTraffic' | 'counterflow' | 'sidewalk' | 'landmark' | 'arriveGood'
  | 'arriveBad' | 'hurry' | 'heat' | 'waiting' | 'throne';

export type LineDef = readonly [text: string, mood: Mood];
export interface LinePool {
  base: readonly LineDef[];
  trait?: Partial<Record<PassengerTrait, readonly LineDef[]>>;
}

export const LINES: Record<Situation, LinePool> = {
  greet: {
    base: [['사왓디{kha}! gram 기사님 맞죠?', 'happy'], ['사왓디{kha}~ 생각보다 빨리 오셨네요', 'happy'],
      ['여기요, 여기! 손 흔드는 사람이요', 'neutral'], ['안녕하세요! 헬멧 주세요~', 'happy'],
      ['사왓디{kha}. 목적지 앱에 찍어놨어요', 'neutral']],
    trait: {
      hurry: [['드디어! 빨리 가요, 레우레우!', 'angry'], ['사왓디… 인사는 나중에! 출발해요!', 'angry'], ['늦었어요 늦었어, 바로 가요!', 'neutral']],
      nervous: [['사, 사왓디{kha}… 천천히 가 주실 거죠?', 'scared'], ['헬멧 꽉 조여 주세요… 처음이라서요', 'scared'], ['안전 운전 약속해 주세요!', 'neutral']],
      tourist: [['사왓디{kha}! …제 발음 맞아요?', 'happy'], ['와, 진짜 오토바이 택시다! 신기해요', 'happy'], ['방콕 처음이에요! 잘 부탁해요', 'happy']],
      shopper: [['사왓디{kha}! 짐이 좀 많은데 괜찮죠?', 'neutral'], ['잠깐만요, 봉지 좀 정리하고요…', 'neutral'], ['이거 다 실을 수 있을까요? 하하', 'happy']],
      regular: [['어이 농~ 오늘도 너구나!', 'happy'], ['사왓디 농! 렉 이모는 잘 계시지?', 'happy'], ['또 만났네~ 늘 가던 데로!', 'happy']],
    },
  },
  board: {
    base: [['헬멧 썼어요. 출발해도 돼요!', 'happy'], ['꽉 잡았어요. 가요!', 'neutral'], ['오케이, 출발~', 'happy'],
      ['자리 편하네요. 가 주세요', 'neutral']],
    trait: {
      hurry: [['레우레우! 최대한 빨리요!', 'angry'], ['출발! 시간 없어요!', 'neutral']],
      nervous: [['천천히… 차차… 부탁해요', 'scared'], ['손잡이 어디 잡아요? 아, 여기요', 'scared']],
      tourist: [['셀카 한 장만! …좋아요, 출발!', 'happy'], ['영상 찍을게요! 출발~', 'happy']],
      shopper: [['봉지 무릎에 올렸어요. 살살 가요~', 'neutral'], ['짐 꽉 잡았어요! 출발!', 'neutral']],
      regular: [['가자, 농! 싸바이싸바이~', 'happy'], ['늘 하던 대로 부탁해~', 'happy']],
    },
  },
  nearMiss: {
    base: [['헉! 방금 엄청 가까웠어요!', 'scared'], ['아이야! 미러 닿을 뻔했어요', 'scared'], ['으악! 숨 참았어요', 'scared'],
      ['오이! 너무 붙었어요!', 'scared'], ['와… 종이 한 장 차이였어요', 'scared']],
    trait: {
      hurry: [['좋아요, 그렇게 비집고!', 'happy'], ['아슬아슬! 그래도 빨라서 좋아요', 'happy'], ['그 틈 최고! 계속 가요!', 'happy']],
      nervous: [['꺄악! 떡짜이(깜짝) 했잖아요!', 'scared'], ['제발요, 제발 천천히요…', 'scared'], ['눈 감고 있을게요…', 'scared']],
      tourist: [['와우! 롤러코스터보다 짜릿해요!', 'happy'], ['방금 그거 찍혔어요! 대박!', 'happy']],
      shopper: [['봉지! 봉지 걸릴 뻔했어요!', 'scared'], ['짐 폭 생각해 주세요~!', 'scared']],
      regular: [['어허, 농! 짜이옌옌~', 'neutral'], ['젊을 때 나도 그랬지, 하하', 'happy']],
    },
  },
  crash: {
    base: [['쿵! 괜찮아요?!', 'scared'], ['아야! 부딪혔잖아요!', 'angry'], ['차에 박았어요! 조심해요!', 'angry'],
      ['오이! 무릎 부딪혔어요…', 'angry']],
    trait: {
      hurry: [['사고 나면 더 늦어요! 정신 차려요!', 'angry'], ['괜찮으니까 빨리 빠져나가요!', 'angry']],
      nervous: [['으앙… 내리고 싶어요…', 'scared'], ['다쳤으면 어떡해요…!', 'scared']],
      tourist: [['오 마이… 이것도 방콕 체험인가요?', 'scared'], ['여행자 보험 되나요…?', 'scared']],
      shopper: [['봉지 터졌어요! 망고 굴러가요!', 'angry'], ['짐! 짐 괜찮아요?!', 'scared']],
      regular: [['어이쿠! 농, 조심 좀 해~', 'angry'], ['마이뺀라이… 근데 다음엔 조심해', 'neutral']],
    },
  },
  fall: {
    base: [['으아아! 넘어졌어요!', 'scared'], ['아파요… 괜찮아요?', 'scared'], ['오이오이… 일어날 수 있어요?', 'scared'],
      ['바닥이랑 인사했네요…', 'angry']],
    trait: {
      hurry: [['지금 넘어질 시간 없어요! 빨리 일으켜요!', 'angry'], ['최악이에요! 시간…!', 'angry']],
      nervous: [['그러니까 천천히 가자고 했잖아요!', 'angry'], ['다시는… 다시는 안 탈 거예요…', 'scared']],
      tourist: [['…이건 여행 영상에서 빼야겠어요', 'scared'], ['괜찮아요, 괜찮아… 아마도요', 'scared']],
      shopper: [['계란! 계란이 다 깨졌어요!', 'angry'], ['쇼핑백 다 쏟아졌잖아요!', 'angry']],
      regular: [['아이고 허리야… 농, 괜찮니?', 'scared'], ['렉 이모한테는 비밀이다…', 'neutral']],
    },
  },
  harshBrake: {
    base: [['으앗! 급브레이크!', 'scared'], ['앞으로 쏠렸어요!', 'scared'], ['헬멧 부딪혔잖아요~', 'angry'],
      ['깜짝이야! 부드럽게요~', 'scared']],
    trait: {
      hurry: [['브레이크 말고 액셀이요!', 'angry'], ['멈추지 마요, 틈 있어요!', 'angry']],
      nervous: [['심장 떨어지는 줄 알았어요!', 'scared'], ['차차… 차차 부탁해요…', 'scared']],
      tourist: [['우왓! 놀이기구 같아요', 'scared'], ['오, 브레이크 성능 좋네요…', 'neutral']],
      shopper: [['봉지가 앞으로 날아갈 뻔!', 'scared'], ['과일 다 쏠렸어요~', 'angry']],
      regular: [['어이쿠, {imo} 허리 생각해 줘~', 'neutral'], ['짜이옌옌, 농~', 'neutral']],
    },
  },
  smooth: {
    base: [['와, 승차감 좋네요', 'happy'], ['싸바이싸바이~ 편해요', 'happy'], ['운전 진짜 부드럽게 하시네요', 'happy'],
      ['바람 시원하다~', 'happy']],
    trait: {
      hurry: [['좋아요, 이 페이스 그대로!', 'happy'], ['이대로면 안 늦겠어요!', 'happy']],
      nervous: [['이 정도면… 괜찮은 것 같아요', 'happy'], ['조금 안심이 돼요', 'neutral']],
      tourist: [['방콕 바람 최고! 경치도 좋고!', 'happy'], ['저 노점 음식 아로이 하겠다~', 'happy']],
      shopper: [['짐 하나도 안 흔들려요. 최고!', 'happy'], ['이렇게만 가 주세요~', 'happy']],
      regular: [['역시 우리 농 운전이 최고야', 'happy'], ['졸리네~ 싸바이~', 'happy']],
    },
  },
  rainStart: {
    base: [['폰똑(비 온다)! 갑자기 쏟아져요!', 'wet'], ['어머, 소나기예요!', 'wet'], ['비다! 우비 있어요?', 'wet'],
      ['하늘이 뚫렸어요!', 'wet']],
    trait: {
      hurry: [['비 와도 멈추면 안 돼요!', 'angry'], ['하필 지금 비가…!', 'wet']],
      nervous: [['길 미끄러워요… 천천히요!', 'scared'], ['비 오면 더 무서운데…', 'scared']],
      tourist: [['이게 방콕 스콜이구나! 신기해요!', 'happy'], ['우와, 진짜 갑자기 오네요!', 'wet']],
      shopper: [['봉지 젖어요! 종이봉투인데!', 'wet'], ['짐 다 젖겠어요~', 'wet']],
      regular: [['우기엔 늘 이렇지 뭐~', 'neutral'], ['{imo} 빨래 널어놨는데…', 'wet']],
    },
  },
  raincoatGiven: {
    base: [['우비 고마워요! 컵쿤{kha}!', 'happy'], ['센스 최고! 안 젖었어요', 'happy'], ['와, 준비성 좋으시네요', 'happy'],
      ['살았다~ 컵쿤{kha}!', 'happy']],
    trait: {
      hurry: [['빨리 입었어요, 출발!', 'happy'], ['좋아요, 이제 달려요!', 'happy']],
      nervous: [['챙겨줘서 고마워요… 마음이 놓여요', 'happy']],
      tourist: [['우비 기념품으로 가져가도 돼요? 하하', 'happy'], ['이거 완전 현지인 같아요!', 'happy']],
      shopper: [['봉지까지 덮었어요! 고마워요~', 'happy']],
      regular: [['역시 농이 최고야~', 'happy']],
    },
  },
  raincoatMissed: {
    base: [['홀딱 젖었어요…', 'wet'], ['우비 없어요? …네', 'wet'], ['속옷까지 젖었어요', 'angry'],
      ['에취! 감기 걸리겠어요', 'wet']],
    trait: {
      hurry: [['젖은 채로 회의 들어가게 생겼네요', 'angry'], ['…빨리라도 가 주세요', 'wet']],
      nervous: [['춥고 무섭고…', 'wet'], ['미끄러질까 봐 더 무서워요', 'scared']],
      tourist: [['이것도 추억이죠… 아마도', 'wet'], ['물에 빠진 생쥐 됐어요, 하하…', 'wet']],
      shopper: [['봉지가 다 녹았어요…', 'angry'], ['종이봉투 찢어졌어요!', 'angry']],
      regular: [['다음엔 우비 좀 챙겨, 농~', 'wet'], ['마이뺀라이… 에취!', 'wet']],
    },
  },
  haze: {
    base: [['콜록콜록… 매연 너무 심해요', 'cough'], ['버스 뒤는 피해 주세요, 숨 막혀요', 'cough'],
      ['미세먼지 장난 아니네요…', 'cough'], ['목이 칼칼해요, 콜록', 'cough']],
    trait: {
      hurry: [['콜록… 그래도 멈추진 마요!', 'cough'], ['매연 뚫고 빨리 가요!', 'cough']],
      nervous: [['앞이 뿌예서 더 무서워요…', 'scared'], ['콜록… 천천히요…', 'cough']],
      tourist: [['방콕 공기… 생각보다 맵네요, 콜록', 'cough'], ['마스크 가져올 걸…', 'cough']],
      shopper: [['음식 봉지에 매연 냄새 배겠어요', 'cough']],
      regular: [['이 동네 공기는 늘 이래~ 콜록', 'cough']],
    },
  },
  maskGiven: {
    base: [['마스크 고마워요! 숨 쉬겠다', 'happy'], ['센스 있으시네요, 컵쿤{kha}', 'happy'],
      ['와, 이제 좀 살 것 같아요', 'happy'], ['배려 감동이에요!', 'happy']],
    trait: {
      hurry: [['좋아요, 이제 달려요!', 'happy']],
      nervous: [['챙겨주니까 마음이 편해요', 'happy']],
      tourist: [['방콕 필수템이군요! 고마워요', 'happy']],
      regular: [['우리 농 다 컸네~', 'happy']],
    },
  },
  slowTraffic: {
    base: [['롯띳(차 막혀)… 꽉 막혔네요', 'neutral'], ['오늘 진짜 막히네요', 'neutral'], ['꼼짝도 안 하네…', 'neutral'],
      ['차 사이로 가면 안 돼요?', 'neutral']],
    trait: {
      hurry: [['비집고 가요! 틈 있잖아요!', 'angry'], ['이러다 늦어요! 레우레우!', 'angry'], ['빨리요, 빨리! 제발!', 'angry']],
      nervous: [['막혀도 괜찮아요, 안전하게만요', 'neutral'], ['천천히 가니까 오히려 좋아요', 'happy']],
      tourist: [['방콕 교통체증 명성 그대로네요!', 'happy'], ['구경할 시간 생겼다~', 'happy']],
      shopper: [['아이스크림 녹는데…', 'neutral']],
      regular: [['방콕이 다 그렇지~ 마이뺀라이', 'happy'], ['느긋하게 가자, 농', 'happy']],
    },
  },
  counterflow: {
    base: [['역주행이에요! 반대 차선!', 'scared'], ['차가 이쪽으로 와요!!', 'scared'], ['이거 반대 방향 아니에요?!', 'scared'],
      ['경찰한테 걸려요~!', 'scared']],
    trait: {
      hurry: [['비어 있으면… 뭐, 좋아요! 빨리!', 'happy'], ['빠르긴 빠르네요…!', 'neutral']],
      nervous: [['안 돼요 안 돼요! 돌아가요!', 'scared'], ['정면에서 차 와요!!', 'scared']],
      tourist: [['이게 현지 스타일인가요?!', 'scared']],
      regular: [['농! {imo} 심장 약해~', 'scared'], ['어어, 이 길 반대야! 농, 돌아가자~', 'scared']],
    },
  },
  sidewalk: {
    base: [['인도예요! 사람들 놀라요!', 'scared'], ['죄송해요~ 지나갈게요~!', 'neutral'], ['노점 조심! 노점!', 'scared'],
      ['여기 사람 다니는 길이잖아요!', 'angry']],
    trait: {
      hurry: [['좋아요, 지름길! 사람만 조심!', 'happy']],
      nervous: [['보행자 칠 것 같아요!', 'scared']],
      tourist: [['여기로 가도 돼요?!', 'scared']],
      shopper: [['봉지가 노점에 걸릴 뻔!', 'scared']],
      regular: [['저 노점 아저씨 내 친구야, 조심해~', 'neutral']],
    },
  },
  landmark: {
    base: [['와, {place} 예쁘다~', 'happy'], ['{place}다! 잠깐 천천히요', 'happy'], ['저기 {place} 보여요!', 'happy'],
      ['{place} 앞은 늘 북적이네요', 'neutral']],
    trait: {
      hurry: [['구경은 다음에! 지나가요!', 'neutral']],
      tourist: [['{place}! 사진 찍을게요, 천천히요!', 'happy'], ['찰칵! 와, {place} 최고!', 'happy'],
        ['가이드북에 나온 {place}예요!', 'happy']],
      regular: [['{place}에서 어제 기도했지~', 'happy']],
    },
  },
  arriveGood: {
    base: [['도착! 컵쿤{kha}~', 'happy'], ['딱 맞춰 왔네요. 고마워요!', 'happy'], ['최고였어요! 별 다섯 개!', 'happy'],
      ['편하게 왔어요. 컵쿤{kha}!', 'happy']],
    trait: {
      hurry: [['시간 맞췄다! 은인이에요!', 'happy'], ['뛰어갈게요, 컵쿤{kha}!', 'happy']],
      nervous: [['살아서 왔다… 아니, 진짜 편했어요!', 'happy']],
      tourist: [['방콕 최고의 추억! 컵쿤{kha}!', 'happy'], ['리뷰 꼭 쓸게요!', 'happy']],
      shopper: [['짐 하나도 안 망가졌어요!', 'happy']],
      regular: [['역시 우리 농! 다음에 또 봐~', 'happy'], ['렉 이모한테 칭찬해 둘게~', 'happy']],
    },
  },
  arriveBad: {
    base: [['…도착은 했네요', 'angry'], ['다신 안 탈래요', 'angry'], ['휴, 드디어 내린다', 'angry'],
      ['별점은… 기대하지 마세요', 'angry']],
    trait: {
      hurry: [['늦었잖아요!', 'angry'], ['결국 지각이에요…', 'angry']],
      nervous: [['다리 풀렸어요…', 'scared'], ['땅이다… 살았다…', 'scared']],
      tourist: [['방콕 교통… 잊지 못할 거예요', 'neutral']],
      shopper: [['짐 다 엉망이에요', 'angry']],
      regular: [['농… 오늘은 좀 아니었다', 'neutral']],
    },
  },
  hurry: {
    base: [['조금만 더 빨리 가 주세요!', 'neutral'], ['시간 괜찮을까요…?', 'neutral'], ['레우레우(빨리빨리)요!', 'angry'],
      ['늦을 것 같아요…', 'neutral']],
    trait: {
      hurry: [['레우레우! 레우레우!!', 'angry'], ['지금 몇 분 남았어요?!', 'angry'], ['제발요, 시간이…!', 'angry']],
      nervous: [['늦어도 괜찮아요… 근데 조금만 빨리요', 'neutral']],
      tourist: [['보트 시간 놓치면 안 되는데…', 'neutral']],
      regular: [['{imo} 드라마 시작한다~ 서둘러~', 'neutral']],
    },
  },
  heat: {
    base: [['론막(너무 더워)… 녹아요', 'neutral'], ['그늘로 가요, 그늘!', 'angry'], ['햇볕이 따가워요…', 'neutral'],
      ['땀이 줄줄 나요', 'neutral']],
    trait: {
      hurry: [['더운데 서 있지 말고 가요!', 'angry']],
      nervous: [['어지러워요…', 'neutral']],
      tourist: [['방콕 더위 장난 아니네요!', 'neutral'], ['선크림 안 발랐는데…', 'neutral']],
      shopper: [['아이스크림 다 녹아요!', 'angry']],
      regular: [['이 정도 더위쯤이야~ {imo} 끄떡없어', 'happy']],
    },
  },
  waiting: {
    base: [['기사님 어디쯤이세요?', 'neutral'], ['지도에서 안 움직이시던데…', 'neutral'], ['저 정문 앞에 있어요!', 'neutral'],
      ['오래 기다렸어요~', 'neutral']],
    trait: {
      hurry: [['빨리 와 주세요! 급해요!', 'angry'], ['아직이에요?!', 'angry']],
      nervous: [['천천히 오셔도 돼요, 조심히요', 'neutral']],
      tourist: [['핀 위치 맞죠? 여기 처음이라…', 'neutral']],
      shopper: [['짐 들고 서 있기 힘들어요~', 'neutral']],
      regular: [['천천히 와~ {imo} 커피 마시는 중', 'happy']],
    },
  },
  /** riding off on the golden throne (gear_throne) instead of the usual 'board' line */
  throne: {
    base: [['와… 왕좌?! 오늘은 제가 왕이네요 👑', 'happy'], ['컵쿤{kha}! 이런 자리는 처음이에요', 'happy'],
      ['황금 왕좌라니… 사진 찍어도 돼요?', 'happy'], ['방콕 최고 VIP 대접이네요!', 'happy']],
    trait: {
      hurry: [['왕좌는 좋은데… 빨리 가 주세요, 레우레우!', 'neutral']],
      nervous: [['이렇게 푹신하면 덜 무서울 것 같아요…', 'neutral']],
      tourist: [['태국 왕좌 체험이라니! 인생샷 각이에요', 'happy']],
      shopper: [['짐이랑 저랑 둘 다 왕 대접이네요!', 'happy']],
      regular: [['농, 이거 언제 샀어? {imo} 출세했네~', 'happy']],
    },
  },
};
