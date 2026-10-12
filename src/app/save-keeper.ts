import type { SaveData, Settings } from '../core/types';
import { defaultStore, type KeyValueStore, loadSave, persist, regenFuel } from '../logic';

/** The one live SaveData of the app: every change goes through `commit`, which persists it right away. */
export class SaveKeeper {
  private data: SaveData;

  constructor(private readonly store: KeyValueStore = defaultStore()) {
    this.data = loadSave(store);
    this.regen(Date.now()); // fuel that refilled while the game was closed
  }

  get save(): SaveData {
    return this.data;
  }

  commit(next: SaveData): SaveData {
    this.data = next;
    if (!persist(next, this.store)) console.warn('[app] the save could not be written (storage unavailable)');
    return next;
  }

  /** applies the free fuel refill clock; true when fuel arrived (and was persisted) */
  regen(now: number): boolean {
    const next = regenFuel(this.data, now);
    if (next === this.data) return false;
    this.commit(next);
    return true;
  }

  settings(next: Settings): SaveData {
    return this.commit({ ...this.data, settings: { ...next } });
  }
}
