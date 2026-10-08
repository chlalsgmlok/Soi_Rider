/**
 * Bangkok motorbike licence plate carrying the rider's nickname: white plate, ink rim,
 * "วิน ๒๓" (win stand 23, Thai numerals) · NICKNAME · "กรุงเทพมหานคร".
 */
import { h } from '../../core/h';

export interface Plate {
  el: HTMLElement;
  set(name: string): void;
}

export function licensePlate(name: string, size: 'md' | 'lg' = 'md'): Plate {
  const nameEl = h('span.g-plate__name', name);
  const el = h(
    'div.g-plate',
    { class: `g-plate--${size}`, role: 'img', aria: { label: `번호판 ${name}` } },
    h('span.g-plate__top.t-thai', { lang: 'th' }, 'วิน ๒๓'),
    nameEl,
    h('span.g-plate__bottom.t-thai', { lang: 'th' }, 'กรุงเทพมหานคร'),
  );
  return {
    el,
    set(next) {
      const text = next.trim() || '—';
      if (nameEl.textContent === text) return;
      nameEl.textContent = text;
      el.setAttribute('aria-label', `번호판 ${text}`);
      el.classList.toggle('is-long', Array.from(text).length > 7);
    },
  };
}
