/**
 * Results gram receipt: brand head with a reserved stamp slot, the itemised score lines + SCORE total, then the
 * payment block (요금 · 팁 · 보너스 → 받은 돈 ฿). Built on components/receipt; the reveal is driven here through the
 * Sequencer so the whole slip can be fast-forwarded. Styling: results-receipt.css.
 */
import type { RunResult } from '../../../core/types/game';
import { h } from '../../core/h';
import { receipt } from '../../components/receipt';
import { countUp, fmtBaht, fmtInt, fmtSigned } from '../../core/count-up';
import { gramBadge } from '../intro/gram-brand';
import type { Sequencer } from './sequencer';
import { bonusDetail, receiptMeta, tipDetail } from './results-copy';

export interface ResultsReceipt {
  el: HTMLElement;
  /** top-right slot in the head where the grade stamp lands */
  stampSlot: HTMLElement;
  /** coins fly from here */
  payTotal: HTMLElement;
  revealScore(seq: Sequencer, tick: () => void): Promise<void>;
  revealPay(seq: Sequencer, tick: () => void): Promise<void>;
}

const plusBaht = (v: number): string => (v > 0 ? `+${fmtBaht(v)}` : fmtBaht(v));

function payRow(label: string, detail: string): { row: HTMLElement; value: HTMLElement } {
  const value = h('span.receipt__value', '฿0');
  const row = h('div.receipt__row.is-hidden', h('span.receipt__label', label, h('small', detail)), h('span.receipt__leader'), value);
  return { row, value };
}

function show(row: HTMLElement, value: HTMLElement, v: number): void {
  row.classList.remove('is-hidden');
  row.classList.add('is-in');
  value.classList.toggle('is-neg', v < 0);
  value.classList.toggle('is-pos', v > 0);
}

export function resultsReceipt(r: RunResult): ResultsReceipt {
  const failed = r.stats.failed !== null;
  const stampSlot = h('div.res-rcpt__stamp');
  const head = h(
    'div.res-rcpt__head',
    h(
      'div.res-rcpt__brand',
      h('div.res-rcpt__logo', gramBadge('sm'), h('span.res-rcpt__kind', '운행 영수증')),
      h('div.receipt__meta', receiptMeta(r).map((m) => h('div', m))),
    ),
    stampSlot,
  );
  const slip = receipt({ head, rows: r.lines.map((l) => ({ label: l.label, detail: l.detail, value: l.value })), totalLabel: 'SCORE', total: r.total });
  slip.el.classList.add('res-rcpt', failed ? 'is-failed' : 'is-paid');
  const values = slip.rows.map((row) => row.querySelector<HTMLElement>('.receipt__value') ?? h('span'));

  const fare = payRow('요금', failed ? '결제 취소' : '미터 요금');
  const tip = payRow('팁', tipDetail(r));
  const bonus = payRow('보너스', bonusDetail(r));
  const payTotal = h('span.res-pay__total-value.t-num', '฿0');
  const pay = h(
    'div.res-pay',
    h('div.res-pay__sep', h('span', '결제 · PAYMENT')),
    fare.row,
    tip.row,
    bonus.row,
    h('div.res-pay__total', h('span.res-pay__total-label', failed ? '결제 취소' : '받은 돈'), payTotal),
  );
  slip.paper.append(pay);

  return {
    el: slip.el,
    stampSlot,
    payTotal,
    async revealScore(seq, tick) {
      for (let i = 0; i < slip.rows.length; i++) {
        const v = r.lines[i].value;
        show(slip.rows[i], values[i], v);
        await seq.count(countUp(values[i], 0, v, { duration: 190, format: fmtSigned, onStep: tick }));
        await seq.wait(25);
      }
      await seq.count(countUp(slip.total, 0, r.total, { duration: 620, format: fmtInt, onStep: tick }));
    },
    async revealPay(seq, tick) {
      const lines: Array<[{ row: HTMLElement; value: HTMLElement }, number, (v: number) => string]> = [
        [fare, r.fareBaht, fmtBaht],
        [tip, r.tipBaht, plusBaht],
        [bonus, r.bonusBaht, plusBaht],
      ];
      pay.classList.add('is-open');
      for (const [line, v, fmt] of lines) {
        show(line.row, line.value, v);
        await seq.count(countUp(line.value, 0, v, { duration: 200, format: fmt, onStep: tick }));
        await seq.wait(30);
      }
      pay.classList.add('is-totalled');
      await seq.count(countUp(payTotal, 0, r.totalBaht, { duration: 520, format: fmtBaht, onStep: tick }));
    },
  };
}
