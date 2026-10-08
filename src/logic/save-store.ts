import type { SaveData, Settings } from '../core/types';
import { createDefaultSave } from './save-defaults';
import { repairSave } from './save-repair';
import { defaultStore, type KeyValueStore } from './storage';

/** Save persistence (docs/GAME_DESIGN.md §11). Corrupted or partial data is repaired, and the raw text is backed up. */
export const SAVE_KEY = 'soi-rider:save:v1';
/** raw text of the last save that needed repair, kept so a bad migration never silently destroys progress */
export const SAVE_BACKUP_KEY = `${SAVE_KEY}:backup`;

export function loadSave(store: KeyValueStore = defaultStore()): SaveData {
  const raw = store.get(SAVE_KEY);
  if (raw === null) return createDefaultSave();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[save] save data is not valid JSON; starting a fresh profile (raw data backed up)', err);
    store.set(SAVE_BACKUP_KEY, raw);
    return resetSave(store);
  }

  const { save, repaired } = repairSave(parsed);
  if (repaired.length > 0) {
    console.warn(`[save] repaired save fields: ${repaired.join(', ')}`);
    store.set(SAVE_BACKUP_KEY, raw);
    persist(save, store);
  }
  return save;
}

/** writes the save; false when it could only be kept in memory (storage blocked or full) */
export function persist(save: SaveData, store: KeyValueStore = defaultStore()): boolean {
  return store.set(SAVE_KEY, JSON.stringify(save));
}

/** wipes progress back to a fresh profile and persists it; pass `keepSettings` to preserve audio/graphics preferences */
export function resetSave(store: KeyValueStore = defaultStore(), keepSettings?: Settings): SaveData {
  const fresh = createDefaultSave();
  const save = keepSettings ? { ...fresh, settings: { ...keepSettings } } : fresh;
  persist(save, store);
  return save;
}
