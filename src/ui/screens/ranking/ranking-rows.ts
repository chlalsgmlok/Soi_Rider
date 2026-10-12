/** Building blocks of the ranking screen: one rider row, the "my best" card, loading rows and the status note. */
import type { RankingEntry, RankingView } from '../../../core/types/screens';
import { h } from '../../core/h';
import { fmtInt } from '../../core/count-up';
import { icon } from '../../icons/icon';

const MEDAL = ['gold', 'silver', 'bronze'] as const;

function rankBadge(rank: number): HTMLElement {
  const medal = rank <= 3 ? MEDAL[rank - 1] : null;
  return h('span.rank-row__rank.t-num', { class: medal ? `is-${medal}` : null }, medal ? icon('trophy', 16) : null, String(rank));
}

export function gradeBadge(grade: string | null): HTMLElement {
  return h('span.rank-grade', { class: grade ? `rank-grade--${grade}` : 'is-none' }, grade ?? '–');
}

export function rankRow(e: RankingEntry): HTMLElement {
  return h(
    'li.rank-row',
    { class: e.me ? 'is-me' : null, aria: { label: `${e.rank}위 ${e.nickname} ${e.score}점` } },
    rankBadge(e.rank),
    h('span.rank-row__name', e.nickname, e.me ? h('span.rank-row__me', '나') : null),
    gradeBadge(e.grade),
    h('span.rank-row__score.t-num', fmtInt(e.score)),
  );
}

/** placeholder rows while the board loads */
export function loadingRows(n = 7): HTMLElement[] {
  return Array.from({ length: n }, () => h('li.rank-row.is-loading', { aria: { hidden: true } }, h('span.rank-row__shimmer')));
}

/** offline / error / empty note shown in place of the list */
export function statusNote(view: RankingView, onRetry: () => void, retry: HTMLElement): HTMLElement {
  const empty = view.status === 'online' && view.entries.length === 0;
  const text = empty ? '아직 아무도 기록을 올리지 않았어요. 첫 번째 라이더가 되어 보세요!' : view.message ?? '';
  const note = h('div.rank-note', { role: 'status' }, icon(view.status === 'error' ? 'alert' : 'info', 22), h('p', text));
  if (view.status === 'error') {
    retry.onclick = onRetry;
    note.append(retry);
  }
  return note;
}

/** left card: this rider's best score, grade and place on the board */
export function myCard(view: RankingView | null): HTMLElement {
  const m = view?.mine;
  const place = !view
    ? '불러오는 중…'
    : view.status === 'offline'
      ? '온라인 순위 미연결'
      : view.status === 'error'
        ? '순위를 확인할 수 없어요'
        : m?.rank
          ? `${m.rank}위 · ${fmtInt(view.total)}명 중`
          : m && m.score > 0
            ? '순위 등록 중…'
            : '첫 운행을 마치면 순위에 올라요';
  return h(
    'aside.rank-me',
    h('span.rank-me__kicker', 'MY BEST · 내 최고 기록'),
    h('span.rank-me__name', m?.nickname ?? ''),
    h('div.rank-me__score', h('b.t-num', fmtInt(m?.score ?? 0)), h('small', '점')),
    h('div.rank-me__row', gradeBadge(m?.grade ?? null), h('span.rank-me__place', { class: m?.rank ? 'is-ranked' : null }, place)),
    h('p.rank-me__hint', '최고 점수는 운행을 마칠 때마다 자동으로 등록돼요.'),
  );
}
