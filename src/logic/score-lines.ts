import { SCORE, TRAITS } from '../core/config/scoring';
import type { FailReason, PassengerTrait, RunStats, ScoreLine } from '../core/types';
import { finiteOr } from './finite';

/**
 * Individual score formulas (docs/GAME_DESIGN.md §10) and their receipt lines. Non-finite inputs count as 0 (an empty
 * counter, no comfort, no time line) so the total, grade and receipt always stay numbers.
 */

/** landmark slow-passes that still earn the tourist bonus */
export const LANDMARK_MAX = 3;

export const FAIL_LABEL: Record<FailReason, string> = {
  comfort: '손님이 중간에 내림',
  falls: '넘어짐 3회',
  timeout: '콜 취소 (시간 초과)',
  abandon: '운행 포기',
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** a counter or a duration: never negative, never NaN */
const count = (n: number): number => Math.max(0, finiteOr(n));

/** mm:ss, sign kept for negative values; "--:--" when unknown */
export function formatClock(sec: number): string {
  if (!Number.isFinite(sec)) return '--:--';
  const s = Math.round(Math.abs(sec));
  const text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return sec < 0 && s > 0 ? `-${text}` : text;
}

/** `1500 × clamp(2·(ETA − t)/ETA, −0.5, 1)`, × trait time multiplier (hurry ×2), capped at 3000 */
export function timeScore(etaSec: number, timeSec: number, trait: PassengerTrait): number {
  if (!(etaSec > 0) || !Number.isFinite(etaSec) || !Number.isFinite(timeSec)) return 0;
  const factor = clamp((2 * (etaSec - timeSec)) / etaSec, -0.5, 1);
  return Math.round(Math.min(SCORE.timeCap, SCORE.timeMax * factor * TRAITS[trait].timeMult));
}

/** 2000 minus incident costs, floored at 0 */
export function safetyScore(s: RunStats): number {
  const cost = SCORE.fall * count(s.falls) + SCORE.bump * count(s.bumps) + SCORE.mirror * count(s.mirrorClips) +
    SCORE.pedScare * count(s.pedScares) + SCORE.curb * count(s.curbHits) + SCORE.redLight * count(s.redLights);
  return Math.max(0, finiteOr(SCORE.safetyBase - cost));
}

/** final comfort × 20 (0..2000); a non-finite comfort scores 0 */
export const comfortScore = (finalComfort: number): number =>
  Math.round(clamp(finiteOr(finalComfort), 0, 100) * SCORE.comfortPerPoint);

export const styleScore = (s: RunStats): number => clamp(Math.round(finiteOr(s.stylePoints)), 0, SCORE.styleCap);

export function careScore(s: RunStats, trait: PassengerTrait): number {
  const landmarks = trait === 'tourist' ? Math.min(LANDMARK_MAX, Math.floor(count(s.landmarkBonus))) : 0;
  return (s.raincoat === 'given' ? SCORE.careRaincoat : 0) + (s.mask === 'given' ? SCORE.careMask : 0) +
    (s.smoothArrival ? SCORE.careSmooth : 0) + landmarks * SCORE.careLandmark;
}

/** ≤ 0: −15 per second of counterflow, −20 per second on the sidewalk */
export const penaltyScore = (s: RunStats): number =>
  0 - Math.round(SCORE.counterflowPerSec * count(s.counterflowSec) + SCORE.sidewalkPerSec * count(s.sidewalkSec));

const joinParts = (parts: Array<[string, number]>, empty: string, unit = ''): string => {
  const shown = parts.filter(([, n]) => Number.isFinite(n) && n > 0).map(([label, n]) => `${label} ${n}${unit}`);
  return shown.length > 0 ? shown.join(' · ') : empty;
};

function careDetail(s: RunStats, trait: PassengerTrait): string {
  const parts: string[] = [];
  if (s.raincoat === 'given') parts.push('우비');
  else if (s.raincoat === 'missed') parts.push('우비 놓침');
  if (s.mask === 'given') parts.push('마스크');
  else if (s.mask === 'missed') parts.push('마스크 놓침');
  if (s.smoothArrival) parts.push('부드러운 도착');
  if (trait === 'tourist' && s.landmarkBonus > 0) parts.push(`관광 서행 ${Math.min(LANDMARK_MAX, s.landmarkBonus)}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function buildScoreLines(s: RunStats, trait: PassengerTrait): ScoreLine[] {
  const failed = s.failed !== null;
  const hurry = TRAITS[trait].timeMult !== 1 ? ` · ${TRAITS[trait].label} ×${TRAITS[trait].timeMult}` : '';
  const late = s.timeSec > s.etaSec && s.etaSec > 0;
  /* any counted time shows as at least 1 s so a non-zero penalty never reads "없음" */
  const penaltySec = (n: number): number => (n > 0 ? Math.max(1, Math.round(n)) : 0);
  return [
    {
      key: 'delivery', label: '기본 배달',
      value: failed ? 0 : SCORE.delivery,
      detail: failed && s.failed ? FAIL_LABEL[s.failed] : '배달 완료',
    },
    {
      key: 'time', label: '시간',
      value: failed ? 0 : timeScore(s.etaSec, s.timeSec, trait),
      detail: `예상 ${formatClock(s.etaSec)} · 실제 ${formatClock(s.timeSec)}${late ? ' · 지각' : ''}${hurry}`,
    },
    {
      key: 'safety', label: '안전', value: safetyScore(s),
      detail: joinParts([['넘어짐', s.falls], ['충돌', s.bumps], ['미러', s.mirrorClips], ['보행자', s.pedScares],
        ['연석', s.curbHits], ['신호위반', s.redLights]], '무사고'),
    },
    { key: 'comfort', label: '승차감', value: comfortScore(s.finalComfort), detail: `승차감 ${Math.round(clamp(finiteOr(s.finalComfort), 0, 100))}` },
    {
      key: 'style', label: '스타일', value: styleScore(s),
      detail: joinParts([['니어미스', s.nearMisses], ['퍼펙트갭', s.perfectGaps], ['추월', s.filterPasses],
        ['최대 콤보', s.maxCombo]], '—'),
    },
    { key: 'care', label: '배려', value: careScore(s, trait), detail: careDetail(s, trait) },
    {
      key: 'penalty', label: '패널티', value: penaltyScore(s),
      detail: joinParts([['역주행', penaltySec(s.counterflowSec)], ['인도', penaltySec(s.sidewalkSec)]], '없음', '초'),
    },
  ];
}
