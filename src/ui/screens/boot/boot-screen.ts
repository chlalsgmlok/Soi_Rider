/**
 * BOOT — logo lockup over a dusk Bangkok skyline, the road loader (cyan route + scooter) and rotating tips.
 * BootProps.progress / label arrive through handle.update().
 */
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { pop, stagger } from '../../core/animate';
import { bootRoad } from './boot-road';
import { tipRotator } from './boot-tips';
import { cablesSvg, skylineSvg } from './boot-skyline';
import './boot.css';

export function mountBoot(ctx: ScreenContext<'boot'>): ScreenView<'boot'> {
  const props = ctx.props();
  const road = bootRoad(props.progress);
  const tips = tipRotator();
  const label = h('div.boot__label', { aria: { live: 'polite' } }, props.label);

  const logo = h(
    'h1.boot-logo',
    { aria: { label: 'SOI RIDER — 방콕 오토바이 택시' } },
    h('span.boot-logo__word', 'SOI'),
    h('span.boot-logo__word.boot-logo__word--accent', 'RIDER'),
  );
  const vest = h(
    'div.boot-vest',
    h('span.boot-vest__th.t-thai', { lang: 'th' }, 'วินมอเตอร์ไซค์'),
    h('span.boot-vest__no.t-num', '23'),
  );
  const tagline = h('div.boot-tagline', h('span.boot-tagline__rule'), h('span', '방콕 오토바이 택시'), h('span.boot-tagline__rule'));
  const lockup = h('div.boot-lockup', logo, vest, tagline);
  const loader = h('div.boot__loader', road.el, label);

  ctx.el.append(
    h(
      'div.boot',
      h('div.boot__sky', { aria: { hidden: true } }, h('span.boot__sun')),
      cablesSvg(),
      skylineSvg(),
      h('div.boot__stage', lockup, loader, tips.el),
      h('div.boot__foot', h('span.t-kicker', 'BANGKOK · ', h('span.t-thai', { lang: 'th' }, 'กรุงเทพฯ')), h('span.t-kicker', 'v0.1')),
    ),
  );

  ctx.onDispose(() => {
    road.dispose();
    tips.dispose();
  });

  return {
    enter() {
      pop(logo, { from: 0.7, spring: { k: 300, c: 16 } });
      stagger([vest, tagline, loader, tips.el], { delay: 180, step: 90 });
      tips.start();
    },
    update(next, changed) {
      if (changed.progress !== undefined) road.set(next.progress);
      if (changed.label !== undefined && label.textContent !== next.label) label.textContent = next.label;
    },
    back: () => true,
  };
}
