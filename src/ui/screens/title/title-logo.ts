/**
 * Title logo lockup: soi street plate · chunky italic "SOI RIDER" (toy extrusion, RIDER in gram cyan) ·
 * a zebra crossing with the rider puck trailing a dashed cyan route · Korean tagline with Thai signage flavour.
 */
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { crosswalkBand, soiPlate } from '../../components/street';

export function titleLogo(): HTMLElement {
  return h(
    'div.title-logo',
    soiPlate({ th: 'ซอยสุขุมวิท 23', en: 'Sukhumvit Soi 23', no: '23', class: 'title-logo__plate' }),
    h(
      'h1.title-logo__word',
      { aria: { label: 'SOI RIDER' } },
      h('span.title-logo__soi', { aria: { hidden: true } }, 'SOI'),
      h('span.title-logo__rider', { aria: { hidden: true } }, 'RIDER'),
    ),
    h(
      'div.title-logo__road',
      { aria: { hidden: true } },
      crosswalkBand({ moving: true, ink: true }),
      h('span.title-logo__route'),
      h('span.title-logo__puck', icon('bike', 22)),
    ),
    h(
      'p.title-logo__tag',
      h('span.title-logo__ko', '방콕 오토바이 택시'),
      h('span.title-logo__th.t-thai', { lang: 'th' }, 'วินมอเตอร์ไซค์รับจ้าง'),
    ),
  );
}
