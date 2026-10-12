import { defaultStore, type KeyValueStore } from '../logic/storage';

const ID_KEY = 'soi-rider:player-id';
const SYNCED_KEY = 'soi-rider:ranked-score';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const hex = (n: number): string => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

/**
 * This device's anonymous rider id on the online ranking (no account needed) and the best score already sent, so a
 * record is uploaded once. Stored next to the save, not inside it.
 */
export class PlayerIdentity {
  constructor(private readonly store: KeyValueStore = defaultStore()) {}

  get id(): string {
    const known = this.store.get(ID_KEY);
    if (known && /^[0-9a-f-]{36}$/i.test(known)) return known;
    const id = newId();
    this.store.set(ID_KEY, id);
    return id;
  }

  /** best score the board already has from this device (0 = nothing sent yet) */
  synced(): number {
    const n = Number(this.store.get(SYNCED_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  markSynced(score: number): void {
    this.store.set(SYNCED_KEY, String(Math.max(this.synced(), Math.round(score))));
  }
}
