/** Style-guide sections: gram phone, results receipt + stamps, feedback (speech, toasts, sheet, loader). */
import type { UiServices } from '../core/screen-types';
import type { Child } from '../core/h';
import { h } from '../core/h';
import { button } from './button';
import { chip } from './chip';
import { phoneFrame, gramBar, gramCard } from './phone';
import { avatar } from './avatar';
import { speech } from './speech';
import { loaderRoad } from './loader';
import { receipt, gradeStamp, stars } from './receipt';
import { stamp } from '../core/animate';
import type { Grade } from '../../core/types/game';

type Sec = (kicker: string, title: string, opts: { wide?: boolean; light?: boolean }, ...body: Child[]) => HTMLElement;

const LOOK = { skin: '#D9A47A', shirt: '#F2559A', pants: '#2B3A5C', hair: 'hair_long', hairColor: '#1E1B1A' } as const;
const LOOK2 = { skin: '#F1C9A5', shirt: '#3EE6D4', pants: '#2A2C31', hair: 'hat_cap', hairColor: '#2C56B8' } as const;

export function galleryPhone(sec: Sec): HTMLElement {
  const offer = (sel: boolean, name: string, look: typeof LOOK | typeof LOOK2, trait: Child, fare: number, km: string): HTMLElement =>
    gramCard(
      { selected: sel },
      h('div.u-row', avatar(look, 'sm'), h('div.u-grow', h('b', name), h('div.t-caption', { style: { color: 'var(--t-on-light-2)' } }, `${km} · 아속 → 시암`)), trait),
      h('div.u-row', { style: { marginTop: '8px' } }, h('span.t-caption', { style: { color: 'var(--t-on-light-2)' } }, '“7시 미팅이에요, 서둘러 주세요!”'), h('span.u-grow'), h('b.t-num', { style: { fontSize: '18px' } }, `฿${fare}`)),
    );
  const phone = phoneFrame(
    { width: 300 },
    gramBar(chip({ text: '온라인', tone: 'good', live: true, size: 'sm', solid: true })),
    h('div', { style: { padding: '10px 14px 2px', fontWeight: 800, fontSize: '18px' } }, '새 콜 3건'),
    offer(true, '말리 (Mali)', LOOK, chip({ text: '급해요', tone: 'warn', size: 'sm', solid: true }), 142, '2.1 km'),
    offer(false, '켄지 (Kenji)', LOOK2, chip({ text: '첫 방콕', tone: 'info', size: 'sm', solid: true }), 96, '1.4 km'),
    h('div', { style: { flex: '1' } }),
    h('div', { style: { padding: '0 12px 6px' } }, button({ label: '콜 수락', icon: 'check', block: true, key: 'E' })),
    h('div.phone__home'),
  );
  return sec(
    '07 · gram',
    '폰 · 아바타 · 말풍선',
    { light: true },
    h(
      'div.gallery__row.gallery__row--top',
      phone.el,
      h('div.gallery__stack', speech('기사님, 7시까지 갈 수 있을까요?', 'neutral'), speech('우비 고마워요!', 'happy'), speech('으악! 미러 닿았어요!', 'scared'), speech('너무 험하게 달리시네요…', 'angry'), speech('비 와요! 우비 있어요?', 'wet'), speech('콜록… 매연이 심해요', 'cough'), h('div.u-row', avatar(LOOK, 'lg'), avatar(LOOK2, 'lg'), avatar({ ...LOOK, hair: 'hair_bun', shirt: '#34B04A', skin: '#B9805A' }, 'lg'), avatar({ ...LOOK2, hair: 'hair_short', shirt: '#FFB23E', hairColor: '#5A3A28' }, 'lg'))),
    ),
  );
}

export function galleryReceipt(sec: Sec): HTMLElement {
  const r = receipt({
    head: h('span.gram-logo', 'gram'),
    meta: ['TRIP 03 · SUKHUMVIT', '18:42 · 노을 · 소나기'],
    rows: [
      { label: 'DELIVERY', detail: '기본', value: 1000 },
      { label: 'TIME', detail: 'ETA −00:41', value: 1180 },
      { label: 'SAFETY', detail: '미러 1', value: 1880 },
      { label: 'COMFORT', detail: '88', value: 1760 },
      { label: 'STYLE', detail: '콤보 ×6', value: 1240 },
      { label: 'CARE', detail: '우비', value: 400 },
      { label: 'PENALTY', detail: '역주행 2s', value: -30 },
    ],
    barcode: true,
  });
  r.el.style.width = '320px';
  const stamps = (['S', 'A', 'B', 'C', 'D', 'F'] as Grade[]).map((g) => gradeStamp(g, { size: 'sm' }));
  const big = gradeStamp('S', { size: 'lg' });
  big.style.position = 'absolute';
  big.style.right = '-30px';
  big.style.top = '60px';
  const holder = h('div', { style: { position: 'relative' } }, r.el, big);
  const replay = button({
    label: '정산 재생',
    icon: 'refresh',
    size: 'sm',
    variant: 'paper',
    onClick: () => {
      r.rows.forEach((x) => x.classList.add('is-hidden'));
      big.style.visibility = 'hidden';
      void r.reveal({ rowMs: 260 }).then(() => {
        big.style.visibility = '';
        stamp(big);
      });
    },
  });
  void r.reveal({ rowMs: 0 });
  return sec('08 · results', '영수증 · 등급 도장 · 별점', { light: true }, h('div.gallery__row.gallery__row--top', holder, h('div.gallery__stack', h('div.u-row', ...stamps), stars(4.5, { size: 'lg' }), stars(3), replay)));
}

export function galleryFeedback(sec: Sec, ui: UiServices): HTMLElement {
  const road = loaderRoad(0.62);
  road.el.style.marginTop = '30px';
  return sec(
    '09 · feedback',
    '토스트 · 시트 · 로딩',
    { wide: true },
    h(
      'div.gallery__row',
      button({ label: 'info', size: 'sm', variant: 'ghost', onClick: () => ui.toast('경로를 다시 찾았어요', 'info', 'route') }),
      button({ label: 'good', size: 'sm', variant: 'ghost', onClick: () => ui.toast('손님이 우비를 입었어요 · 승차감 +12', 'good', 'raincoat') }),
      button({ label: 'warn', size: 'sm', variant: 'ghost', onClick: () => ui.toast('매연이 짙어요 — 버스 뒤를 피하세요', 'warn', 'haze') }),
      button({ label: 'bad', size: 'sm', variant: 'ghost', onClick: () => ui.toast('연료가 부족해요', 'bad', 'fuel') }),
      button({
        label: '구매 시트',
        size: 'sm',
        icon: 'cart',
        onClick: () => ui.sheet({ title: '고양이 귀 헬멧을 살까요?', icon: 'helmet', body: '손님 첫인상 +1 · 450฿ (보유 1,240฿)', actions: [{ id: 'no', label: '취소', variant: 'paper' }, { id: 'yes', label: '450฿ 구매', variant: 'primary', icon: 'cart', sfx: 'buy', autofocus: true }] }),
      }),
    ),
    road.el,
  );
}
