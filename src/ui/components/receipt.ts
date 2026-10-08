/**
 * Results vocabulary.
 *   const r = receipt({ meta: ['TRIP 03', 'SUKHUMVIT · 18:42'], rows: result.lines.map(l => ({ label: l.label, detail: l.detail, value: l.value })), totalLabel: 'TOTAL' });
 *   await r.reveal({ onTick })   — rows slide in one by one and count up, then the total
 *   gradeStamp('S') + stamp(el) from core/animate; stars(4.5)
 * Styling: styles/components/receipt.css.
 */
import type { Grade } from '../../core/types/game';
import { h, s, type Child } from '../core/h';
import { icon } from '../icons/icon';
import { countUp, fmtInt, fmtSigned } from '../core/count-up';

export interface ReceiptRow {
  label: string;
  detail?: string;
  value: number;
  /** format override (default signed integer) */
  format?: (v: number) => string;
}

export interface Receipt {
  el: HTMLElement;
  paper: HTMLElement;
  rows: HTMLElement[];
  total: HTMLElement;
  /** sequential reveal: rows fade in and count up, then the total. Instant under reduced motion. */
  reveal(opts?: { rowMs?: number; onTick?: () => void; onRow?: (i: number) => void }): Promise<void>;
}

export function receipt(o: { meta?: string[]; head?: Child; rows: ReceiptRow[]; totalLabel?: string; total?: number; barcode?: boolean }): Receipt {
  const values = o.rows.map(() => h('span.receipt__value', '0'));
  const rows = o.rows.map((r, i) =>
    h(
      'div.receipt__row.is-hidden',
      h('span.receipt__label', r.label, r.detail ? h('small', r.detail) : null),
      h('span.receipt__leader'),
      values[i],
    ),
  );
  const totalValue = o.total ?? o.rows.reduce((a, r) => a + r.value, 0);
  const total = h('span.receipt__total-value', '0');
  const paper = h(
    'div.receipt__paper',
    o.head || o.meta ? h('div.receipt__head', o.head ?? null, o.meta ? h('div.receipt__meta', o.meta.map((m) => h('div', m))) : null) : null,
    h('hr.receipt__sep'),
    rows,
    h('hr.receipt__sep'),
    h('div.receipt__total', h('span.receipt__total-label', o.totalLabel ?? 'TOTAL'), total),
    o.barcode ? h('div.receipt__barcode', { aria: { hidden: true } }) : null,
  );
  const el = h('div.receipt', paper);
  return {
    el,
    paper,
    rows,
    total,
    async reveal(opts = {}) {
      const ms = opts.rowMs ?? 420;
      for (let i = 0; i < rows.length; i++) {
        const r = o.rows[i];
        rows[i].classList.remove('is-hidden');
        rows[i].classList.add('is-in');
        values[i].classList.toggle('is-neg', r.value < 0);
        values[i].classList.toggle('is-pos', r.value > 0);
        opts.onRow?.(i);
        await countUp(values[i], 0, r.value, { duration: ms, format: r.format ?? fmtSigned, onStep: opts.onTick }).done;
      }
      await countUp(total, 0, totalValue, { duration: 900, format: fmtInt, onStep: opts.onTick }).done;
    },
  };
}

export function gradeStamp(grade: Grade, opts: { size?: 'sm' | 'md' | 'lg'; onDark?: boolean; label?: string } = {}): HTMLDivElement {
  const ring = s(
    'svg',
    { class: 'grade-stamp__ring', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    s('defs', null, s('path', { id: `gs-arc-${grade}`, d: 'M 14 50 A 36 36 0 0 1 86 50' })),
    s('text', { 'text-anchor': 'middle' }, s('textPath', { href: `#gs-arc-${grade}`, startOffset: '50%' }, opts.label ?? 'SOI RIDER · GRADE')),
  );
  return h(
    'div.grade-stamp',
    { class: [opts.size && opts.size !== 'md' && `grade-stamp--${opts.size}`, opts.onDark && 'grade-stamp--on-dark'], data: { grade }, role: 'img', aria: { label: `등급 ${grade}` } },
    ring,
    h('span.grade-stamp__letter', grade),
  );
}

/** 0..5 in 0.5 steps; half stars drawn with a clipped overlay */
export function stars(value: number, opts: { max?: number; size?: 'md' | 'lg'; onDark?: boolean } = {}): HTMLSpanElement {
  const max = opts.max ?? 5;
  const v = Math.round(value * 2) / 2;
  const items: HTMLElement[] = [];
  for (let i = 1; i <= max; i++) {
    const full = v >= i;
    const half = !full && v >= i - 0.5;
    items.push(
      half
        ? h('span', { style: { position: 'relative', display: 'inline-block' } }, icon('star', 18, { class: 'is-empty' }), h('span', { style: { position: 'absolute', inset: '0', width: '50%', overflow: 'hidden' } }, icon('star', 18)))
        : h('span', icon('star', 18, { class: full ? undefined : 'is-empty' })),
    );
  }
  return h('span.stars', { class: [opts.size === 'lg' && 'stars--lg', opts.onDark && 'stars--on-dark'], role: 'img', aria: { label: `별점 ${v} / ${max}` } }, items);
}
