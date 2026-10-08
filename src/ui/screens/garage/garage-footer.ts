/**
 * Garage footer: status line + [상점] [되돌리기] [CTA]. The CTA follows the preview:
 *   clean   → "장착 완료" (disabled)
 *   changed → "장착하기" (onEquip)
 *   unowned → inline two-step "구매하고 장착 ฿total" (buys every missing item, then equips)
 */
import { h } from '../../core/h';
import { button } from '../../components/button';
import { fmtBaht } from '../../core/count-up';
import { pop } from '../../core/animate';
import { confirmBuy } from '../shop/confirm-buy';
import type { GarageModel } from './garage-model';

export interface GarageFooterHooks {
  shop(): void;
  revert(): void;
  equip(btn: HTMLButtonElement): void;
  buyAll(btn: HTMLButtonElement): void;
  denyAll(btn: HTMLButtonElement): void;
}

export interface GarageFooter {
  el: HTMLElement;
  /** element coins fly into on "buy all" */
  target: HTMLElement;
  refresh(model: GarageModel): void;
}

export function garageFooter(model: GarageModel, hooks: GarageFooterHooks): GarageFooter {
  const status = h('p.g-foot__status');
  const shop = button({ label: '상점', icon: 'cart', variant: 'secondary', onClick: () => hooks.shop() });
  const revert = button({ icon: 'refresh', variant: 'ghost', title: '되돌리기 — 장착 중인 모습으로', sfx: 'back', onClick: () => hooks.revert() });
  const cta = h('div.g-foot__cta');
  const el = h('footer.g-foot', status, h('div.g-foot__row', shop, revert, cta));
  let mode = '';

  const refresh = (m: GarageModel): void => {
    const changes = m.changes();
    const missing = m.unowned();
    const total = missing.reduce((s, it) => s + it.price, 0);
    const affordable = m.save.baht >= total;
    revert.disabled = changes === 0;
    if (changes === 0) status.textContent = '지금 모습 그대로 출근해요';
    else if (!missing.length) status.textContent = `변경 ${changes}개 · 장착하면 저장돼요`;
    else if (affordable) status.textContent = `미보유 ${missing.length}개 · 합계 ${fmtBaht(total)} (보유 ${fmtBaht(m.save.baht)})`;
    else status.textContent = `${fmtBaht(total - m.save.baht)} 부족 · 미보유 아이템을 빼거나 콜을 더 뛰어 봐요`;
    status.dataset.tone = changes === 0 ? 'good' : missing.length && !affordable ? 'bad' : missing.length ? 'warn' : 'info';

    const next = changes === 0 ? 'clean' : missing.length ? `buy:${total}:${affordable}` : 'equip';
    if (next === mode) return;
    mode = next;
    if (next === 'clean') {
      cta.replaceChildren(button({ label: '장착 완료', icon: 'check', block: true, disabled: true }));
    } else if (next === 'equip') {
      const b = button({ label: '장착하기', icon: 'check', block: true, sfx: 'none', onClick: () => hooks.equip(b) });
      cta.replaceChildren(b);
      pop(b, { from: 0.9 });
    } else {
      const buyer = confirmBuy({
        price: total,
        affordable,
        label: '구매하고 장착',
        confirmLabel: '결제하고 장착',
        block: true,
        onConfirm: (btn) => hooks.buyAll(btn),
        onDeny: (btn) => hooks.denyAll(btn),
      });
      cta.replaceChildren(buyer.el);
      pop(buyer.el, { from: 0.9 });
    }
  };
  refresh(model);
  return { el, target: cta, refresh };
}
