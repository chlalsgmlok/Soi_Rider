import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STARTER_LOADOUT } from '../core/config/catalog';
import { createDefaultSave, DEFAULT_SETTINGS, STARTER_ITEM_IDS } from './save-defaults';
import { loadSave, persist, resetSave, SAVE_BACKUP_KEY, SAVE_KEY } from './save-store';
import { browserStore, memoryStore } from './storage';

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe('defaults', () => {
  it('starts with 300 ฿, 5 fuel, the starter loadout and default settings', () => {
    const s = createDefaultSave();
    expect(s.version).toBe(1);
    expect(s.baht).toBe(300);
    expect(s.fuel).toBe(5);
    expect(s.loadout).toEqual(STARTER_LOADOUT);
    expect(s.settings).toEqual({
      master: 0.8, music: 0.6, sfx: 0.8, quality: 'auto', camera: 'auto', minimap: true, reducedMotion: false, touch: 'auto',
    });
    expect(s.bestGrade).toEqual({ light: null, rush: null, gridlock: null });
    expect(s.freeRefillAtTrip).toBe(-3);
    expect(s.tripsCompleted).toBe(0);
  });

  it('owns the catalog starters and every item of the starter loadout, nothing else', () => {
    const owned = createDefaultSave().owned;
    for (const id of ['bike:cub', 'helmet:helmet_open', 'outfit:tee', 'gear:none', 'color:taxi_pink', 'color:gram_cyan',
      'color:mango', 'color:tuk_blue', 'color:jasmine']) expect(owned).toContain(id);
    expect(owned).not.toContain('bike:scooter');
    expect(owned).not.toContain('color:leaf_green');
    expect(owned.some((id) => id.startsWith('fuel:'))).toBe(false);
    expect(owned).toEqual([...STARTER_ITEM_IDS]);
  });

  it('returns independent copies', () => {
    const a = createDefaultSave();
    a.loadout.nickname = 'X';
    a.settings.master = 0;
    expect(createDefaultSave().loadout.nickname).toBe('NONG');
    expect(DEFAULT_SETTINGS.master).toBe(0.8);
  });
});

describe('load / persist / reset', () => {
  it('loads defaults from an empty store and round-trips a persisted save', () => {
    const store = memoryStore();
    expect(loadSave(store)).toEqual(createDefaultSave());
    const s = { ...createDefaultSave(), baht: 777, fuel: 2, tripsCompleted: 9, bestScore: 6400 };
    expect(persist(s, store)).toBe(true);
    expect(JSON.parse(store.get(SAVE_KEY) ?? '')).toEqual(s);
    expect(loadSave(store)).toEqual(s);
    expect(warn).not.toHaveBeenCalled();
    expect(store.get(SAVE_BACKUP_KEY)).toBeNull();
  });

  it('starts fresh on invalid JSON and keeps the raw text as a backup', () => {
    const store = memoryStore({ [SAVE_KEY]: '{"baht": 12' });
    const s = loadSave(store);
    expect(s).toEqual(createDefaultSave());
    expect(store.get(SAVE_BACKUP_KEY)).toBe('{"baht": 12');
    expect(JSON.parse(store.get(SAVE_KEY) ?? '')).toEqual(createDefaultSave());
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('repairs a partial save, keeps valid fields and re-persists the repaired data', () => {
    const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, baht: 1234 }) });
    const s = loadSave(store);
    expect(s.baht).toBe(1234);
    expect(s.fuel).toBe(5);
    expect(s.loadout).toEqual(STARTER_LOADOUT);
    expect(JSON.parse(store.get(SAVE_KEY) ?? '').baht).toBe(1234);
    expect(store.get(SAVE_BACKUP_KEY)).toContain('1234');
  });

  it('resetSave wipes progress, optionally keeping settings', () => {
    const store = memoryStore();
    persist({ ...createDefaultSave(), baht: 9999 }, store);
    const kept = { ...DEFAULT_SETTINGS, master: 0.2, camera: 'pov' as const };
    const s = resetSave(store, kept);
    expect(s.baht).toBe(300);
    expect(s.settings).toEqual(kept);
    expect(loadSave(store).settings.master).toBe(0.2);
    expect(resetSave(store).settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('browser storage fallback', () => {
  const g = globalThis as { localStorage?: Storage };
  afterEach(() => {
    delete g.localStorage;
  });

  function fakeStorage(opts: { failWrites?: boolean; failReads?: boolean } = {}): Storage {
    const map = new Map<string, string>();
    let probing = true;
    const fake = {
      getItem: (k: string) => {
        if (opts.failReads) throw new Error('blocked');
        return map.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (opts.failWrites && !probing) throw new Error('QuotaExceededError');
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
        probing = false;
      },
      clear: () => map.clear(),
      key: () => null,
      get length() {
        return map.size;
      },
    };
    return fake as unknown as Storage;
  }

  it('falls back to memory when localStorage does not exist (node)', () => {
    const store = browserStore();
    expect(store.set('k', 'v')).toBe(false);
    expect(store.get('k')).toBe('v');
  });

  it('writes through to localStorage when it works', () => {
    g.localStorage = fakeStorage();
    const store = browserStore();
    expect(store.set('k', 'v')).toBe(true);
    expect(g.localStorage.getItem('k')).toBe('v');
    expect(browserStore().get('k')).toBe('v');
  });

  it('keeps the session state in memory when writes fail (quota / private mode)', () => {
    g.localStorage = fakeStorage({ failWrites: true });
    const store = browserStore();
    const s = { ...createDefaultSave(), baht: 4321 };
    expect(persist(s, store)).toBe(false);
    expect(loadSave(store).baht).toBe(4321);
    expect(warn).toHaveBeenCalled();
  });

  it('survives a localStorage that throws on access', () => {
    g.localStorage = fakeStorage({ failReads: true });
    const store = browserStore();
    expect(store.get('missing')).toBeNull();
    expect(loadSave(store)).toEqual(createDefaultSave());
  });
});
