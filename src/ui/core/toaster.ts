/**
 * Toast stack (top-centre, under the prompt banner). Max 3 visible, de-duplicates bursts of the same text,
 * auto-dismiss scaled by text length. toast(text, tone, icon?) — icon is any IconName (falls back per tone).
 */
import type { Tone } from '../../core/events';
import { h } from './h';
import { icon } from '../icons/icon';
import { ICONS, type IconName } from '../icons/icon-paths';
import { pop, popOut, settled } from './animate';

const TONE_ICON: Record<Tone, IconName> = { info: 'info', good: 'check', warn: 'warning', bad: 'alert' };
const MAX = 3;

const isIcon = (name: string | undefined): name is IconName => !!name && Object.prototype.hasOwnProperty.call(ICONS, name);

export class Toaster {
  readonly el: HTMLElement;
  private recent = new Map<string, number>();

  constructor(layer: HTMLElement) {
    this.el = h('div.toast-stack', { role: 'status', aria: { live: 'polite' } });
    layer.append(this.el);
  }

  show(text: string, tone: Tone = 'info', iconName?: string): void {
    const now = performance.now();
    const key = `${tone}|${text}`;
    if ((this.recent.get(key) ?? -1e9) > now - 700) return;
    this.recent.set(key, now);
    const glyph = isIcon(iconName) ? iconName : TONE_ICON[tone];
    const t = h(`div.toast.toast--${tone}`, h('span.toast__icon', icon(glyph, 16)), h('span.toast__text', text));
    this.el.append(t);
    pop(t, { from: 0.8 });
    // dismiss() is async (removal after the exit animation), so count only toasts that are not already leaving
    const active = [...this.el.children].filter((c) => !(c as HTMLElement).dataset.leaving) as HTMLElement[];
    for (let i = 0; i < active.length - MAX; i++) this.dismiss(active[i]);
    const ms = Math.min(4800, 2000 + text.length * 45);
    window.setTimeout(() => this.dismiss(t), ms);
  }

  private dismiss(t: HTMLElement): void {
    if (!t.isConnected || t.dataset.leaving) return;
    t.dataset.leaving = '1';
    void settled(popOut(t, { to: 0.92 })).then(() => t.remove());
  }

  clear(): void {
    this.el.replaceChildren();
  }
}
