/**
 * Header row shared by garage / shop / setup: [← Esc] [soi plate] title + sub … right slot (wallets).
 *   menuHeader({ plate: { th: 'ร้านค้า', en: 'Shop' }, title: '상점', sub: '…', onBack, right: wallets.el })
 */
import './menu-shared.css';
import { h, type Child, type ClassValue } from '../../core/h';
import { button } from '../../components/button';
import { soiPlate, type SoiPlateOpts } from '../../components/street';

export interface MenuHeaderOpts {
  plate: SoiPlateOpts;
  title: string;
  sub?: string;
  onBack(): void;
  right?: Child;
  class?: ClassValue;
}

export function menuHeader(o: MenuHeaderOpts): HTMLElement {
  const back = button({ icon: 'back', variant: 'ghost', title: '뒤로 (Esc)', sfx: 'back', class: 'menu-head__back', onClick: () => o.onBack() });
  return h(
    'header.menu-head',
    { class: o.class },
    back,
    soiPlate({ ...o.plate, class: ['menu-head__plate', o.plate.class] }),
    h('div.menu-head__text', h('h1.menu-head__title', o.title), o.sub ? h('p.menu-head__sub', o.sub) : null),
    h('span.u-grow'),
    o.right ?? null,
  );
}
