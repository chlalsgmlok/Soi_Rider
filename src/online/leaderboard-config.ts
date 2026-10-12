/**
 * Where the online ranking lives: a Supabase project (docs/leaderboard-setup.md). Set VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY in `.env` (the anon key is public by design; the table is guarded by row-level security).
 * Without them the ranking screen shows only this device's record.
 */
export interface LeaderboardConfig {
  url: string;
  key: string;
}

export function leaderboardConfig(env: Record<string, unknown> = import.meta.env): LeaderboardConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== 'string' || typeof key !== 'string' || !url.trim() || !key.trim()) return null;
  return { url: url.trim().replace(/\/+$/, ''), key: key.trim() };
}

/** how many riders the ranking screen lists */
export const BOARD_SIZE = 50;
/** a network call slower than this counts as offline (ms) */
export const REQUEST_TIMEOUT = 6000;
