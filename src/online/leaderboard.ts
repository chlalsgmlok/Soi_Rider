import type { Grade, RankingEntry, RankingView, SaveData } from '../core/types';
import { gradeFor } from '../logic/grade';
import { BOARD_SIZE, leaderboardConfig } from './leaderboard-config';
import { PlayerIdentity } from './player-identity';
import { type BoardRow, SupabaseBoard } from './supabase-board';

const GRADES: readonly Grade[] = ['S', 'A', 'B', 'C', 'D', 'F'];
const asGrade = (g: string): Grade => (GRADES as readonly string[]).includes(g) ? (g as Grade) : 'D';
const nicknameOf = (save: SaveData): string => save.loadout.nickname.trim() || 'RIDER';

/**
 * The online ranking (best score per rider, docs/GAME_DESIGN.md §11). Uploads this rider's best once it beats what
 * the board already has, and builds the RankingView for the ranking screen. Without a configured server
 * (leaderboard-config) everything stays local: status 'offline' with only this rider's record.
 */
export class Leaderboard {
  constructor(
    private readonly board: SupabaseBoard | null = createBoard(),
    private readonly identity = new PlayerIdentity(),
  ) {}

  get online(): boolean {
    return this.board !== null;
  }

  /** sends the save's best score when it beats the last upload; returns this rider's rank (null = nothing new / offline) */
  async sync(save: SaveData): Promise<number | null> {
    if (!this.board || save.bestScore <= this.identity.synced()) return null;
    await this.board.submit(this.identity.id, nicknameOf(save), save.bestScore, gradeFor(save.bestScore, false));
    this.identity.markSynced(save.bestScore);
    return (await this.board.rankOf(save.bestScore)).rank;
  }

  async view(save: SaveData): Promise<RankingView> {
    const mine: RankingView['mine'] = {
      rank: null, nickname: nicknameOf(save), score: save.bestScore, grade: save.bestScore > 0 ? gradeFor(save.bestScore, false) : null,
    };
    if (!this.board) {
      return { status: 'offline', entries: [], mine, total: 0, message: '온라인 순위 서버가 아직 연결되지 않았어요. 지금은 내 최고 기록만 보여요.' };
    }
    try {
      await this.sync(save).catch(() => null);
      const [rows, place] = await Promise.all([this.board.top(BOARD_SIZE), save.bestScore > 0 ? this.board.rankOf(save.bestScore) : null]);
      const me = this.identity.id;
      const entries = rows.map((r, i): RankingEntry => toEntry(r, i, rows, me));
      return { status: 'online', entries, mine: { ...mine, rank: place?.rank ?? null }, total: place?.total ?? rows.length };
    } catch {
      return { status: 'error', entries: [], mine, total: 0, message: '순위를 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.' };
    }
  }
}

/** ties share a rank (1, 2, 2, 4 …) */
function toEntry(r: BoardRow, i: number, rows: readonly BoardRow[], me: string): RankingEntry {
  const first = rows.findIndex((x) => x.score === r.score);
  return { rank: (first < 0 ? i : first) + 1, nickname: r.nickname, score: r.score, grade: asGrade(r.grade), me: r.player_id === me };
}

function createBoard(): SupabaseBoard | null {
  const cfg = leaderboardConfig();
  return cfg ? new SupabaseBoard(cfg) : null;
}
