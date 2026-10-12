import type { Grade } from '../core/types/game';
import type { RankingEntry, RankingView } from '../core/types/screens';

const RIDERS: readonly [string, number, Grade][] = [
  ['TUK TUK KING', 9120, 'S'], ['PLOY', 8840, 'S'], ['BEAM', 8840, 'S'], ['SOI 23 GOLF', 7710, 'S'], ['MILK', 7020, 'A'],
  ['FERN', 6650, 'A'], ['NONG', 6480, 'A'], ['BANK', 6010, 'A'], ['KAO', 5480, 'B'], ['NAM', 5120, 'B'], ['PING', 4630, 'B'],
  ['BOSS', 3980, 'C'], ['TAE', 3310, 'C'], ['JUB', 2410, 'D'],
];

/** mock RankingView for ui-menu.html?view=ranking | ranking-offline | ranking-error (no network) */
export function demoRanking(mode: string, best: number): RankingView {
  const mine = { rank: null, nickname: 'NONG', score: best, grade: best > 0 ? ('A' as Grade) : null };
  if (mode === 'ranking-offline') {
    return { status: 'offline', entries: [], mine, total: 0, message: '온라인 순위 서버가 아직 연결되지 않았어요. 지금은 내 최고 기록만 보여요.' };
  }
  if (mode === 'ranking-error') {
    return { status: 'error', entries: [], mine, total: 0, message: '순위를 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.' };
  }
  const entries = RIDERS.map(([nickname, score, grade], i): RankingEntry => ({
    rank: RIDERS.findIndex((r) => r[1] === score) + 1 || i + 1, nickname, score, grade, me: nickname === 'NONG',
  }));
  return { status: 'online', entries, mine: { ...mine, rank: 7, score: 6480, grade: 'A' }, total: 128 };
}
