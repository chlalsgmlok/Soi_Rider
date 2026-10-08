import { CATALOG, FREE_REFILL_EVERY, STARTER_LOADOUT, STARTING_BAHT, STARTING_FUEL } from '../core/config/catalog';
import type { SaveData, Settings } from '../core/types';
import { loadoutItemIds } from './loadout-items';

/** Fresh-profile values (docs/GAME_DESIGN.md §11). */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  quality: 'auto',
  camera: 'auto',
  minimap: true,
  reducedMotion: false,
  touch: 'auto',
};

/** `freeRefillAtTrip` value meaning "never used": the refill is available from trip 0. */
export const NEVER_REFILLED = -FREE_REFILL_EVERY;

/**
 * Items owned from the start: every non-consumable catalog item flagged `starter`, plus everything STARTER_LOADOUT
 * equips (its helmet colour `color:jasmine` is not a catalog starter, and the default outfit must always be valid).
 */
export const STARTER_ITEM_IDS: readonly string[] = [
  ...new Set([
    ...CATALOG.filter((c) => c.starter && c.category !== 'fuel').map((c) => c.id),
    ...loadoutItemIds(STARTER_LOADOUT),
  ]),
];
const STARTER_SET: ReadonlySet<string> = new Set(STARTER_ITEM_IDS);

export const isStarterItem = (id: string): boolean => STARTER_SET.has(id);

export const starterItemIds = (): string[] => [...STARTER_ITEM_IDS];

export function createDefaultSave(): SaveData {
  return {
    version: 1,
    baht: STARTING_BAHT,
    fuel: STARTING_FUEL,
    owned: starterItemIds(),
    loadout: { ...STARTER_LOADOUT },
    tripsCompleted: 0,
    bestScore: 0,
    bestGrade: { light: null, rush: null, gridlock: null },
    freeRefillAtTrip: NEVER_REFILLED,
    settings: { ...DEFAULT_SETTINGS },
  };
}
