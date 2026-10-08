/** Korean HUD copy + glyph choices (data tables). */
import type { MissionPhase, PassengerTrait, TimeOfDay, WeatherKind } from '../../core/types/game';
import type { PromptId } from '../../core/types/hud';
import type { CameraMode } from '../../core/types/save';
import type { IconName } from '../icons/icon';
import type { ChipTone } from '../components/chip';

export const PHASE_TEXT: Record<MissionPhase, string> = {
  intro: '콜 수락 대기',
  toPickup: '픽업 장소로 이동 중',
  boarding: '손님 탑승 중',
  toDropoff: '목적지로 운행 중',
  arriving: '도착 · 천천히 정차',
  complete: '운행 완료',
  failed: '운행 취소됨',
};

export const TARGET_LABEL: Record<MissionPhase, string> = {
  intro: '픽업까지',
  toPickup: '픽업까지',
  boarding: '탑승 중',
  toDropoff: '목적지까지',
  arriving: '목적지 도착',
  complete: '도착 완료',
  failed: '운행 종료',
};

/** big centre callout on mission:phase */
export const PHASE_CALLOUT: Partial<Record<MissionPhase, { title: string; accent: string; sub: string; tone: 'info' | 'good' | 'bad' }>> = {
  toPickup: { title: 'LET’S', accent: 'GO!', sub: '손님에게 이동하세요', tone: 'info' },
  boarding: { title: 'PICK', accent: 'UP!', sub: '손님 탑승 — 헬멧 건네는 중', tone: 'good' },
  toDropoff: { title: 'NEXT', accent: 'STOP', sub: '목적지까지 안전 운행', tone: 'info' },
  arriving: { title: 'ALMOST', accent: 'THERE', sub: '핀 안쪽 링에 부드럽게 정차', tone: 'info' },
  complete: { title: 'ARRIVED', accent: '!', sub: '운행 완료 — 정산 중', tone: 'good' },
  failed: { title: 'TRIP', accent: 'FAILED', sub: '손님이 내렸어요', tone: 'bad' },
};

export const TRAIT: Record<PassengerTrait, { label: string; tone: ChipTone; icon: IconName }> = {
  hurry: { label: '급해요', tone: 'warn', icon: 'clock' },
  nervous: { label: '겁 많음', tone: 'pink', icon: 'alert' },
  tourist: { label: '첫 방콕', tone: 'info', icon: 'camera' },
  shopper: { label: '짐 많음', tone: 'tuk', icon: 'box' },
  regular: { label: '단골', tone: 'good', icon: 'star' },
};

export function weatherGlyph(kind: WeatherKind, rain: number, tod: TimeOfDay): { icon: IconName; label: string; tone: ChipTone } {
  if (kind === 'rain') return rain > 0.6 ? { icon: 'rain', label: '폭우', tone: 'tuk' } : { icon: 'rain', label: '소나기', tone: 'tuk' };
  if (kind === 'haze') return { icon: 'haze', label: '매연 주의', tone: 'warn' };
  if (kind === 'overcast') return { icon: 'cloud', label: '흐림', tone: 'neutral' };
  if (tod === 'night') return { icon: 'moon', label: '맑은 밤', tone: 'neutral' };
  if (tod === 'noon') return { icon: 'heat', label: '폭염', tone: 'warn' };
  if (tod === 'sunset') return { icon: 'sun', label: '노을', tone: 'neutral' };
  return { icon: 'sun', label: '맑음', tone: 'neutral' };
}

export const CAMERA_LABEL: Record<CameraMode, string> = { auto: '자동', diorama: '디오라마', pov: '1인칭' };

export const PROMPT_ICON: Record<PromptId, IconName> = {
  raincoat: 'raincoat',
  mask: 'mask',
  board: 'user',
  dropoff: 'flag',
  pickup_hint: 'pin',
};

/** mood → glyph lives with the speech component (shared by HUD, Intro and story stills) */
export { MOOD_ICON } from '../components/speech';
