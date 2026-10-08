/**
 * Passenger speech bubble (Intro offers, story stills, HUD): speech('기사님, 7시까지 갈 수 있을까요?', 'neutral').
 * Mood picks the tint + glyph. Styling: .speech / .speech--<mood> in styles/components/feedback.css.
 */
import type { Mood } from '../../core/events';
import { h, type ClassValue } from '../core/h';
import { icon, type IconName } from '../icons/icon';

export const MOOD_ICON: Record<Mood, IconName> = {
  happy: 'smile',
  neutral: 'meh',
  scared: 'alert',
  angry: 'frown',
  wet: 'drop',
  cough: 'haze',
};

export function speech(text: string, mood: Mood = 'neutral', cls?: ClassValue): HTMLDivElement {
  return h('div.speech', { class: [`speech--${mood}`, cls] }, h('span.speech__mood', icon(MOOD_ICON[mood], 14)), h('span.speech__text', text));
}
