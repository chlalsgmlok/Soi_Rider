/** Results copy: grade headlines, fail reasons (Korean), passenger mood, payment row details, receipt meta. */
import type { FailReason, Grade, RunResult } from '../../../core/types/game';
import type { Mood } from '../../../core/events';
import type { IconName } from '../../icons/icon';
import { INTENSITY } from '../../../core/config/traffic';
import { DISTRICT_LABEL } from '../../../logic/forecast';
import { formatClock } from '../../../logic/score-lines';

export interface Headline {
  title: string;
  accent: string;
  sub: string;
  icon: IconName;
}

const GRADE_HEAD: Record<Exclude<Grade, 'F'>, { title: string; accent: string; sub: (name: string) => string }> = {
  S: { title: 'PERFECT', accent: 'RIDE!', sub: (n) => `${n} 님이 감동했어요. 방콕 최고의 라이더!` },
  A: { title: 'GREAT', accent: 'RIDE!', sub: (n) => `${n} 님을 멋지게 모셨어요` },
  B: { title: 'NICE', accent: 'RIDE!', sub: (n) => `${n} 님을 무사히 모셨어요` },
  C: { title: 'NOT', accent: 'BAD!', sub: () => '도착은 했어요. 다음엔 조금 더 부드럽게!' },
  D: { title: 'ROUGH', accent: 'RIDE…', sub: () => '손님이 꽤 놀랐어요. 천천히, 안전하게!' },
};

/** failed-run copy (GAME_DESIGN §8: comfort 0 · 3 falls · ETA × 2.5) */
export const FAIL_COPY: Record<FailReason, { title: string; sub: string; icon: IconName }> = {
  comfort: { title: '손님이 내려버렸어요', sub: '승차감 0 — 급제동과 아슬아슬한 틈은 손님을 지치게 해요.', icon: 'frown' },
  falls: { title: '넘어짐 3회', sub: '세 번이나 넘어지자 손님이 무서워서 내렸어요.', icon: 'alert' },
  timeout: { title: '시간 초과', sub: '너무 늦어져서 손님이 콜을 취소했어요.', icon: 'clock' },
  abandon: { title: '운행 포기', sub: '이번 콜은 실패로 처리됐어요. 다음 콜에서 만회해요!', icon: 'exit' },
};

export function headline(r: RunResult): Headline {
  const fail = r.stats.failed;
  if (fail) return { title: 'TRIP', accent: 'FAILED', sub: FAIL_COPY[fail].sub, icon: FAIL_COPY[fail].icon };
  const g = GRADE_HEAD[r.grade === 'F' ? 'D' : r.grade];
  return { title: g.title, accent: g.accent, sub: g.sub(r.job.passenger.name), icon: 'flag' };
}

export function passengerMood(r: RunResult): Mood {
  const fail = r.stats.failed;
  if (fail === 'falls') return 'scared';
  if (fail) return 'angry';
  return r.grade === 'S' || r.grade === 'A' || r.grade === 'B' ? 'happy' : r.grade === 'C' ? 'neutral' : 'scared';
}

/** receipt head meta lines: "TRIP 03 · 수쿰빗" / "러시아워 · 운행 02:58" */
export function receiptMeta(r: RunResult): string[] {
  const c = r.config;
  return [`TRIP ${String(c.tripNumber).padStart(2, '0')} · ${DISTRICT_LABEL[c.district]}`, `${INTENSITY[c.intensity].label} · 운행 ${formatClock(r.stats.timeSec)}`];
}

export function tipDetail(r: RunResult): string {
  if (r.stats.failed) return '결제 취소';
  const care = [r.stats.raincoat === 'given' && '우비', r.stats.mask === 'given' && '마스크'].filter(Boolean).join(' · ');
  return care ? `${r.grade} 등급 팁 · ${care}` : `${r.grade} 등급 팁`;
}

export const bonusDetail = (r: RunResult): string => (r.bonusBaht > 0 ? '단골 보너스' : '—');
