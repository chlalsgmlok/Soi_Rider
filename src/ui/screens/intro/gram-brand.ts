/**
 * gram driver-app chrome for the Intro phone: the sub-brand badge (lowercase "gram" in a cyan rounded tile — never
 * Grab green), the app bar with the rider and an online status pill, and the "searching for calls" radar.
 * Styling: intro-phone.css.
 */
import { h } from '../../core/h';
import { icon } from '../../icons/icon';

export function gramBadge(size: 'md' | 'sm' = 'md'): HTMLElement {
  return h('span.gram-badge', { class: size === 'sm' && 'gram-badge--sm', aria: { label: 'gram' } }, h('span.gram-badge__word', 'gram'));
}

export interface GramAppBar {
  el: HTMLElement;
  setStatus(text: string, mode: 'idle' | 'busy'): void;
}

export function gramAppBar(nickname: string): GramAppBar {
  const statusText = h('span.gram-status__text', '온라인 · 대기 중');
  const status = h('span.gram-status', { aria: { live: 'polite' } }, h('span.gram-status__dot'), statusText);
  const el = h(
    'div.gram-appbar',
    gramBadge(),
    h('div.gram-appbar__rider', h('span.gram-appbar__role', '기사'), h('span.gram-appbar__name', nickname.trim() || 'NONG')),
    status,
  );
  return {
    el,
    setStatus(text, mode) {
      statusText.textContent = text;
      status.classList.toggle('is-busy', mode === 'busy');
    },
  };
}

/** pulsing rings around the rider puck while gram looks for calls */
export function gramRadar(): HTMLElement {
  return h(
    'div.gram-radar',
    h('div.gram-radar__field', h('span.gram-radar__ring'), h('span.gram-radar__ring'), h('span.gram-radar__ring'), h('span.gram-radar__puck', icon('bike', 26))),
    h('p.gram-radar__text', '주변 콜을 찾는 중…'),
  );
}
