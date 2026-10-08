/** Intro (gram call picker) copy: time-of-day / weather chips, 렉 이모's line, distance + ETA text. */
import type { IntroProps } from '../../../core/types/screens';
import type { PassengerTrait, TimeOfDay, WeatherPlan } from '../../../core/types/game';
import type { IconName } from '../../icons/icon';
import type { ChipTone } from '../../components/chip';
import { fmtDistance } from '../../hud/format';

const TOD: Record<TimeOfDay, { label: string; icon: IconName }> = {
  morning: { label: '아침', icon: 'sun' },
  noon: { label: '한낮', icon: 'heat' },
  sunset: { label: '노을', icon: 'sun' },
  night: { label: '밤', icon: 'moon' },
};

const BASE: Record<WeatherPlan['base'], string> = { clear: '맑음', haze: '연무', overcast: '흐림' };

export interface ChipSpec {
  text: string;
  icon: IconName;
  tone: ChipTone;
}

/** "노을 · 맑음" plus forecast chips for scheduled events */
export function skyChips(tod: TimeOfDay, plan: WeatherPlan): ChipSpec[] {
  const out: ChipSpec[] = [{ text: `${TOD[tod].label} · ${BASE[plan.base]}`, icon: plan.base === 'overcast' ? 'cloud' : plan.base === 'haze' ? 'haze' : TOD[tod].icon, tone: 'neutral' }];
  if (plan.events.some((e) => e.kind === 'downpour')) out.push({ text: '소나기 예보', icon: 'rain', tone: 'tuk' });
  if (plan.events.some((e) => e.kind === 'haze_spike') || plan.haze > 0.5) out.push({ text: '매연 주의', icon: 'mask', tone: 'warn' });
  return out;
}

/** story beat ① — 렉 이모 (stall owner next to the win stand) sends you off */
export function auntieLine(p: Pick<IntroProps, 'nickname' | 'tripNumber' | 'timeOfDay' | 'weather'>): string {
  const nick = p.nickname.trim() || 'NONG';
  if (p.weather.events.some((e) => e.kind === 'downpour')) return `${nick}, 오늘 소나기 온대! 우비 꼭 챙겨 가~`;
  if (p.weather.base === 'haze' || p.weather.events.some((e) => e.kind === 'haze_spike')) return '매연이 심하대. 손님 마스크 챙겨 드려!';
  if (p.tripNumber <= 1) return `첫 콜이네, ${nick}! 천천히, 안전하게~`;
  if (p.timeOfDay === 'night') return `밤 골목은 어두워. 조심히 다녀와, ${nick}!`;
  if (p.timeOfDay === 'noon') return `덥다 더워~ 그늘로 다녀, ${nick}!`;
  return '콜 들어왔다! 마음에 드는 걸로 골라봐~';
}

export const distText = (m: number): string => {
  const d = fmtDistance(m);
  return `${d.num} ${d.unit}`;
};

/** minutes to reach the pickup at a soi pace of ~18 km/h (5 m/s), at least 1 */
export const etaMinutes = (approachMeters: number): number => Math.max(1, Math.round(approachMeters / 5 / 60));

export const two = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, '0');

/** the passenger's chat reply once the call is accepted */
export const REPLY: Record<PassengerTrait, string> = {
  hurry: '감사해요! 빨리만 와 주세요!',
  nervous: '천천히 오셔도 괜찮아요…',
  tourist: 'Thank you! 사진 찍으며 기다릴게요',
  shopper: '짐이 좀 많아요, 미리 죄송해요!',
  regular: '오늘도 부탁해~',
};
