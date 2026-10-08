/**
 * Key/value persistence with a graceful in-memory fallback. localStorage can be missing (node tests), throw on access
 * (blocked cookies, sandboxed iframes) or reject writes (quota, Safari private mode). Every write is mirrored into memory,
 * so the current session never loses progress even when the browser refuses to store it.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  /** true when the value reached durable storage, false when it is only kept in memory */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

export function memoryStore(initial?: Record<string, string>): KeyValueStore {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
      return true;
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}

function usableLocalStorage(): Storage | null {
  try {
    const ls: Storage | undefined = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) return null;
    const probe = '__soi_rider_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/** localStorage-backed store; falls back to memory for every failing call. */
export function browserStore(): KeyValueStore {
  const ls = usableLocalStorage();
  const mem = new Map<string, string>();
  return {
    get(key) {
      const local = mem.get(key);
      if (local !== undefined) return local;
      if (!ls) return null;
      try {
        return ls.getItem(key);
      } catch (err) {
        console.warn('[save] localStorage read failed', err);
        return null;
      }
    },
    set(key, value) {
      mem.set(key, value);
      if (!ls) return false;
      try {
        ls.setItem(key, value);
        return true;
      } catch (err) {
        console.warn('[save] localStorage write failed; progress is kept for this session only', err);
        return false;
      }
    },
    remove(key) {
      mem.delete(key);
      if (!ls) return;
      try {
        ls.removeItem(key);
      } catch (err) {
        console.warn('[save] localStorage remove failed', err);
      }
    },
  };
}

let shared: KeyValueStore | null = null;

/** process-wide store used when callers do not pass their own */
export const defaultStore = (): KeyValueStore => (shared ??= browserStore());
