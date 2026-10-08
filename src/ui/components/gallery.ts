/**
 * Living style guide — every component in its states (sandbox/ui.html?view=components).
 * Doubles as copy-paste usage examples for the screen modules.
 */
import '../styles/gallery.css';
import type { UiServices } from '../core/screen-types';
import { h, type Child } from '../core/h';
import { icon, ICON_NAMES } from '../icons/icon';
import { button } from './button';
import { chip, keycap } from './chip';
import { card } from './card';
import { statBar, meter } from './bars';
import { swatch } from './swatch';
import { tabStrip } from './tab-strip';
import { wallet } from './wallet';
import { soiPlate, curbDivider, crosswalkBand, scallop } from './street';
import { galleryPhone, galleryReceipt, galleryFeedback } from './gallery-extras';
import { galleryMotion } from './gallery-motion';
import { toggle, slider, settingRow } from './inputs';

const sec = (kicker: string, title: string, opts: { wide?: boolean; light?: boolean }, ...body: Child[]): HTMLElement =>
  h('section.gallery__sec', { class: [opts.wide && 'gallery__sec--wide', opts.light && 'gallery__sec--light'] }, h('div.section-head', h('span.section-head__kicker', kicker), h('span.section-head__title', title)), ...body);
const row = (...c: Child[]): HTMLElement => h('div.gallery__row', ...c);
const cap = (t: string): HTMLElement => h('div.gallery__cap', t);

const TOKENS = ['cyan', 'cyan-deep', 'coral', 'amber', 'sun', 'pink', 'mango', 'leaf', 'tuk', 'sign', 'ink', 'ink-2', 'cream', 'asphalt', 'curb-red'];

export function gallery(ui: UiServices): HTMLElement {
  const stats = [statBar({ label: '최고속', value: 0.58, display: '82', delta: 0.16 }), statBar({ label: '가속', value: 0.5, display: '3.2' }), statBar({ label: '핸들링', value: 0.72, display: '0.58', delta: -0.12 }), statBar({ label: '차폭', value: 0.4, display: '0.80' })];
  const tabs = tabStrip({ tabs: [{ id: 'bike', label: '오토바이', icon: 'bike' }, { id: 'paint', label: '페인트', icon: 'palette' }, { id: 'helmet', label: '헬멧', icon: 'helmet', badge: 'N' }, { id: 'outfit', label: '옷', icon: 'shirt' }, { id: 'gear', label: '장비', icon: 'box' }], active: 'paint' });
  const seg = tabStrip({ tabs: [{ id: 'low', label: '낮음' }, { id: 'medium', label: '보통' }, { id: 'high', label: '높음' }, { id: 'auto', label: '자동' }], active: 'auto', segmented: true });
  const sw = [
    swatch({ hex: '#F2559A', name: '택시 핑크', selected: true }),
    swatch({ hex: '#3EE6D4', name: '그램 시안' }),
    swatch({ hex: '#F7C928', name: '망고 옐로' }),
    swatch({ hex: '#2C56B8', name: '뚝뚝 블루' }),
    swatch({ hex: '#E8B640', name: '사원 골드', locked: true, price: 225 }),
    swatch({ hex: '#8A5BFF', name: '네온 퍼플', locked: true, price: 240 }),
  ];
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  const musicVal = h('span.setting-row__value');
  const settings = h(
    'div',
    settingRow('미니맵', '주행 중 그램 폰에 지도 표시', toggle({ checked: true, label: '미니맵' }).el),
    settingRow('모션 줄이기', '전환·팝 애니메이션 최소화', toggle({ checked: false, label: '모션 줄이기' }).el),
    settingRow('음악', null, h('div.u-row', slider({ value: 0.7, label: '음악', format: pct, readout: musicVal }).el, musicVal)),
  );

  return h(
    'div.gallery',
    h(
      'div.gallery__wrap',
      h('div.gallery__hero', h('div.gallery__logo', 'SOI ', h('b', 'RIDER')), soiPlate({ th: 'ระบบการออกแบบ', en: 'Design System', no: 'v1', size: 'lg' }), h('span.u-grow'), wallet('baht', 1240).el, wallet('fuel', 5).el),
      curbDivider(),
      h(
        'div.gallery__grid',
        sec('01 · tokens', '컬러', { wide: true }, h('div.gallery__swatch-tokens', TOKENS.map((t) => h('div.gallery__token', h('i', { style: { background: `var(--c-${t})` } }), h('span', `--c-${t}`))))),
        h('div.gallery__col',
          sec(
            '02 · buttons',
            '버튼',
            {},
            row(button({ label: '출근하기', icon: 'play', key: 'Enter' }), button({ label: '차고', icon: 'helmet', variant: 'secondary' }), button({ label: '설정', icon: 'settings', variant: 'ghost' })),
            row(button({ label: '그만두기', icon: 'exit', variant: 'danger' }), button({ label: '연료 충전', icon: 'fuel', variant: 'sun' }), button({ icon: 'pause', variant: 'ghost', title: '일시정지' }), button({ icon: 'close', variant: 'ghost', size: 'sm', title: '닫기' })),
            cap('sizes · states'),
            row(button({ label: 'SM', size: 'sm' }), button({ label: 'LG', size: 'lg' }), button({ label: '다음 콜', sub: 'TRIP 04', size: 'xl', iconRight: 'arrow-right' })),
            row(button({ label: '구매', locked: true, price: 450, affordable: true }), button({ label: '구매', locked: true, price: 2400 }), button({ label: '사용 불가', disabled: true })),
          ),
          sec(
            '04 · surfaces',
            '표면 · 거리 모티프',
            { light: true },
            row(h('div.glass', { style: { padding: '12px 16px' } }, 'glass'), card({}, h('b', 'card'), h('div.t-caption', '크림 종이 카드')), card({ dark: true }, h('b', 'card--dark')), card({ interactive: true, selected: true }, h('b', 'selected')), card({ locked: true }, h('b', 'locked'), h('div.t-caption', '잠김'))),
            row(soiPlate({ th: 'ซอย สุขุมวิท 23', en: 'Sukhumvit Soi 23', no: 23 }), soiPlate({ en: 'Silom', size: 'mini' }), soiPlate({ th: 'สยาม', en: 'Siam', green: true })),
            h('div.gallery__stack', curbDivider(), curbDivider('amber'), crosswalkBand({ moving: true }), scallop('tuk'), scallop('pink')),
          ),
          sec('06 · navigation', '탭 · 세그먼트 · 설정 행 (toggle · slider)', {}, row(tabs.el), row(seg.el), settings),
          galleryReceipt(sec),
        ),
        h('div.gallery__col',
          sec(
            '03 · chips',
            '칩 · 키캡 · 배지',
            {},
            row(chip({ text: '온라인', live: true, tone: 'good' }), chip({ text: '급해요', tone: 'warn', icon: 'clock' }), chip({ text: '겁 많음', tone: 'pink', icon: 'alert' }), chip({ text: '첫 방콕', tone: 'info', icon: 'camera' }), chip({ text: '짐 많음', tone: 'tuk', icon: 'box' })),
            row(chip({ text: '03:12', icon: 'clock', num: true }), chip({ text: '지연 +00:12', tone: 'bad', solid: true, icon: 'clock' }), chip({ text: 'S 등급', tone: 'pink', solid: true, size: 'lg', icon: 'star' }), chip({ text: '소나기', tone: 'tuk', icon: 'rain', size: 'sm' })),
            row(keycap('E'), keycap('W'), keycap('Space'), keycap('Esc', 'sm'), keycap('C', 'lg'), keycap('H', 'md', true), h('span.badge', '3'), h('span.badge.badge--new', 'NEW')),
          ),
          sec('05 · controls', '스탯 · 미터 · 스와치 · 탭', {}, h('div.gallery__stack', ...stats.map((s) => s.el)), cap('meter'), h('div.gallery__stack', meter({ value: 0.86, tone: 'good' }).el, meter({ value: 0.45, tone: 'warn' }).el, meter({ value: 0.14, tone: 'bad' }).el), cap('swatch'), row(...sw.map((s) => s.el))),
          galleryPhone(sec),
          galleryMotion(sec, ui),
        ),
        galleryFeedback(sec, ui),
        sec('11 · icons', `아이콘 (${ICON_NAMES.length})`, { wide: true }, h('div.gallery__icons', ICON_NAMES.map((n) => h('div.gallery__icon', icon(n, 24), n)))),
      ),
    ),
  );
}

export type SectionFn = typeof sec;
