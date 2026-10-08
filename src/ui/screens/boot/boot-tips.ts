/**
 * Rotating riding tips under the boot loader ("렉 이모의 팁"). Each tip may carry a keycap. Crossfades every
 * TIP_MS; under reduced motion the text just swaps.
 */
import { h } from '../../core/h';
import { keycap } from '../../components/chip';
import { EASE, reducedMotion } from '../../core/motion';
import { settled } from '../../core/animate';

interface Tip {
  key?: string;
  text: string;
}

export const BOOT_TIPS: readonly Tip[] = [
  { key: 'Space', text: '꾹 누르면 몸을 움츠리고 미러를 접어요. 차 사이 좁은 틈은 이걸로!' },
  { key: 'E', text: '소나기가 오면 잠깐 멈추고 우비를 건네세요. 손님 기분도, 팁도 올라가요.' },
  { text: '양쪽 틈이 18 cm 보다 좁은데 무사히 빠져나가면 PERFECT GAP!' },
  { text: '역주행은 빠르지만 초당 −15점. 손님도 불안해해요.' },
  { text: '목적지 핀 안쪽 링에 사뿐히 서면 부드러운 도착 보너스 +300.' },
  { key: 'C', text: '카메라 전환: 자동 → 디오라마 → 1인칭 핸들바 시점.' },
  { text: '겁 많은 손님은 니어미스에 두 배로 놀라요. 살살 모셔요.' },
  { key: 'S', text: '멈춘 채로 브레이크를 계속 누르면 발로 밀어 뒤로 걸어요.' },
  { text: '한낮 땡볕에 오래 서 있으면 손님이 지쳐요. BTS 고가 아래 그늘을 노려요.' },
  { text: '연료가 바닥나면 렉 이모가 한 번은 공짜로 채워줘요.' },
  { key: 'H', text: '경적은 아껴 쓰세요. 방콕 사람들은 경적에 예민해요.' },
];

const TIP_MS = 4200;

export interface TipRotator {
  el: HTMLElement;
  start(): void;
  dispose(): void;
}

export function tipRotator(): TipRotator {
  let i = Math.floor(Math.random() * BOOT_TIPS.length);
  const body = h('div.boot-tip__body');
  const el = h('div.boot-tip', { aria: { live: 'polite' } }, h('span.boot-tip__tag', '렉 이모의 팁'), body);
  let timer = 0;
  let alive = true;

  const render = (): void => {
    const tip = BOOT_TIPS[i];
    body.replaceChildren(...(tip.key ? [keycap(tip.key, 'sm', true)] : []), h('span.boot-tip__text', tip.text));
  };

  const next = async (): Promise<void> => {
    i = (i + 1) % BOOT_TIPS.length;
    if (!reducedMotion()) await settled(body.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 200, fill: 'forwards' }));
    if (!alive) return;
    render();
    if (!reducedMotion()) body.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE.out, fill: 'both' });
  };

  render();
  return {
    el,
    start: () => {
      if (!timer) timer = window.setInterval(() => void next(), TIP_MS);
    },
    dispose: () => {
      alive = false;
      window.clearInterval(timer);
    },
  };
}
