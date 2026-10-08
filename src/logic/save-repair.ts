import { itemById, STARTER_LOADOUT, STARTING_BAHT, STARTING_FUEL } from '../core/config/catalog';
import type { Grade, Loadout, SaveData, Settings, TrafficIntensity } from '../core/types';
import { LOADOUT_SLOTS, itemIdFor, sanitizeNickname, slotValueValid, withSlot } from './loadout-items';
import { DEFAULT_SETTINGS, NEVER_REFILLED, createDefaultSave, starterItemIds } from './save-defaults';

/**
 * Validates untrusted save data (old builds, hand edits, partial writes) field by field. Anything unusable falls back to
 * its default; everything valid is kept, so one bad field never wipes a player's progress.
 */
export interface RepairReport {
  save: SaveData;
  /** names of the fields that had to be replaced or clamped (empty = data was clean) */
  repaired: string[];
}

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const GRADES: readonly Grade[] = ['S', 'A', 'B', 'C', 'D', 'F'];
const INTENSITIES: readonly TrafficIntensity[] = ['light', 'rush', 'gridlock'];
const QUALITIES: readonly Settings['quality'][] = ['auto', 'low', 'medium', 'high'];
const CAMERAS: readonly Settings['camera'][] = ['auto', 'diorama', 'pov'];
const TOUCH: readonly Settings['touch'][] = ['auto', 'on', 'off'];

export function repairSave(raw: unknown): RepairReport {
  if (!isRecord(raw)) return { save: createDefaultSave(), repaired: ['root'] };
  const repaired: string[] = [];
  const note = (field: string): void => {
    repaired.push(field);
  };

  if (raw.version !== 1) note('version');
  const int = (field: string, fallback: number, min: number, max: number): number => {
    const v = raw[field];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      note(field);
      return fallback;
    }
    const fixed = Math.min(max, Math.max(min, Math.round(v)));
    if (fixed !== v) note(field);
    return fixed;
  };

  const baht = int('baht', STARTING_BAHT, 0, 9_999_999);
  const fuel = int('fuel', STARTING_FUEL, 0, 999);
  const tripsCompleted = int('tripsCompleted', 0, 0, 9_999_999);
  const bestScore = int('bestScore', 0, 0, 9_999_999);
  const owned = repairOwned(raw.owned, note);
  const loadout = repairLoadout(raw.loadout, owned, note);
  const bestGrade = repairBestGrade(raw.bestGrade, note);

  let freeRefillAtTrip = NEVER_REFILLED;
  const fr = raw.freeRefillAtTrip;
  if (typeof fr === 'number' && Number.isInteger(fr) && fr >= NEVER_REFILLED && fr <= tripsCompleted) freeRefillAtTrip = fr;
  else note('freeRefillAtTrip');

  const settings = repairSettings(raw.settings, note);
  return {
    save: { version: 1, baht, fuel, owned, loadout, tripsCompleted, bestScore, bestGrade, freeRefillAtTrip, settings },
    repaired,
  };
}

function repairOwned(raw: unknown, note: (f: string) => void): string[] {
  const starters = starterItemIds();
  if (!Array.isArray(raw)) {
    note('owned');
    return starters;
  }
  const valid = raw.filter((id): id is string => {
    if (typeof id !== 'string') return false;
    const item = itemById(id);
    return item !== undefined && item.category !== 'fuel';
  });
  if (valid.length !== raw.length) note('owned');
  /* starter items are always owned; adding ones introduced after the save was written is not a repair */
  return [...new Set([...starters, ...valid])];
}

function repairLoadout(raw: unknown, owned: readonly string[], note: (f: string) => void): Loadout {
  if (!isRecord(raw)) {
    note('loadout');
    return { ...STARTER_LOADOUT };
  }
  let loadout: Loadout = { ...STARTER_LOADOUT };
  for (const slot of LOADOUT_SLOTS) {
    const v = raw[slot];
    if (slotValueValid(slot, v) && owned.includes(itemIdFor(slot, v))) loadout = withSlot(loadout, slot, v);
    else note(`loadout.${slot}`);
  }
  const nickname = sanitizeNickname(raw.nickname, STARTER_LOADOUT.nickname);
  if (nickname !== raw.nickname) note('loadout.nickname');
  return { ...loadout, nickname };
}

function repairBestGrade(raw: unknown, note: (f: string) => void): Record<TrafficIntensity, Grade | null> {
  const out: Record<TrafficIntensity, Grade | null> = { light: null, rush: null, gridlock: null };
  if (!isRecord(raw)) {
    note('bestGrade');
    return out;
  }
  for (const k of INTENSITIES) {
    const g = raw[k];
    if (g === null || g === undefined) continue;
    if (typeof g === 'string' && (GRADES as readonly string[]).includes(g)) out[k] = g as Grade;
    else note(`bestGrade.${k}`);
  }
  return out;
}

function pick<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

function repairSettings(raw: unknown, note: (f: string) => void): Settings {
  const d = DEFAULT_SETTINGS;
  if (!isRecord(raw)) {
    note('settings');
    return { ...d };
  }
  const vol = (k: 'master' | 'music' | 'sfx'): number => {
    const v = raw[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return d[k];
    return Math.min(1, Math.max(0, v));
  };
  const bool = (k: 'minimap' | 'reducedMotion'): boolean => (typeof raw[k] === 'boolean' ? (raw[k] as boolean) : d[k]);
  const s: Settings = {
    master: vol('master'),
    music: vol('music'),
    sfx: vol('sfx'),
    quality: pick(raw.quality, QUALITIES, d.quality),
    camera: pick(raw.camera, CAMERAS, d.camera),
    minimap: bool('minimap'),
    reducedMotion: bool('reducedMotion'),
    touch: pick(raw.touch, TOUCH, d.touch),
  };
  for (const k of Object.keys(s) as (keyof Settings)[]) if (s[k] !== raw[k]) note(`settings.${k}`);
  return s;
}
