import { CATALOG, FREE_REFILL_EVERY, itemById } from '../core/config/catalog';
import type { BuyResult, Loadout, RunResult, SaveData } from '../core/types';
import { finiteOr } from './finite';
import { betterGrade } from './grade';
import { LOADOUT_SLOTS, itemIdFor, sanitizeNickname, slotValueValid, withSlot } from './loadout-items';
import { isStarterItem } from './save-defaults';

/**
 * Wallet, fuel and inventory rules (docs/GAME_DESIGN.md §3, §11). Every function is pure: it returns a new SaveData and
 * never mutates its input. Persisting is the caller's job (save-store.persist).
 */

/** fuel granted by Lek's free refill — equal to the cooldown so a broke player can always reach the next refill */
export const FREE_REFILL_FUEL = FREE_REFILL_EVERY;

export const cheapestFuelPrice = (): number =>
  Math.min(...CATALOG.filter((c) => c.category === 'fuel').map((c) => c.price));

/** starter items (incl. the starter loadout) are always owned; fuel packs are consumables and never "owned" */
export function owns(save: SaveData, itemId: string): boolean {
  const item = itemById(itemId);
  if (!item || item.category === 'fuel') return false;
  return isStarterItem(itemId) || save.owned.includes(itemId);
}

export function buy(save: SaveData, itemId: string): BuyResult {
  const item = itemById(itemId);
  if (!item) return { ok: false, reason: 'unknown', save };
  if (item.category !== 'fuel' && owns(save, itemId)) return { ok: false, reason: 'owned', save };
  if (save.baht < item.price) return { ok: false, reason: 'funds', save };
  const baht = save.baht - item.price;
  if (item.category === 'fuel') return { ok: true, save: { ...save, baht, fuel: save.fuel + (item.amount ?? 0) } };
  return { ok: true, save: { ...save, baht, owned: [...save.owned, itemId] } };
}

/** catalog ids in a loadout the player does not own (UI shows a price / buy button for them) */
export function unownedItems(save: SaveData, loadout: Loadout): string[] {
  return LOADOUT_SLOTS.map((slot) => itemIdFor(slot, loadout[slot])).filter((id) => !owns(save, id));
}

/**
 * Equips a loadout. Each slot is accepted only if it names a valid, owned item; otherwise the currently equipped value
 * stays. The nickname is sanitised (≤ 12 characters, falls back to the current one when empty).
 */
export function equip(save: SaveData, loadout: Loadout): SaveData {
  let next: Loadout = { ...save.loadout };
  for (const slot of LOADOUT_SLOTS) {
    const value: unknown = loadout[slot];
    if (slotValueValid(slot, value) && owns(save, itemIdFor(slot, value))) next = withSlot(next, slot, value);
  }
  return { ...save, loadout: { ...next, nickname: sanitizeNickname(loadout.nickname, save.loadout.nickname) } };
}

/** Lek's free refill: fuel 0, not enough baht for the cheapest pack, and not used within the last FREE_REFILL_EVERY trips */
export function freeRefillAvailable(save: SaveData): boolean {
  return (
    save.fuel <= 0 &&
    save.baht < cheapestFuelPrice() &&
    save.tripsCompleted - save.freeRefillAtTrip >= FREE_REFILL_EVERY
  );
}

export interface StartCheck {
  ok: boolean;
  reason?: 'noFuel';
  freeRefillAvailable: boolean;
}

export function canStartRun(save: SaveData): StartCheck {
  const refill = freeRefillAvailable(save);
  return save.fuel >= 1 ? { ok: true, freeRefillAvailable: refill } : { ok: false, reason: 'noFuel', freeRefillAvailable: refill };
}

/** one trip costs one fuel; returns the save unchanged when the tank is empty */
export function consumeFuel(save: SaveData): SaveData {
  return save.fuel >= 1 ? { ...save, fuel: save.fuel - 1 } : save;
}

/** check + consume in one step (Setup `출근하기`) */
export function startRun(save: SaveData): { ok: boolean; save: SaveData; reason?: 'noFuel' } {
  const check = canStartRun(save);
  return check.ok ? { ok: true, save: consumeFuel(save) } : { ok: false, save, reason: check.reason };
}

/** grants FREE_REFILL_FUEL when available; returns the save unchanged otherwise */
export function claimFreeRefill(save: SaveData): SaveData {
  if (!freeRefillAvailable(save)) return save;
  return { ...save, fuel: save.fuel + FREE_REFILL_FUEL, freeRefillAtTrip: save.tripsCompleted };
}

/**
 * Books a finished run (successful, failed or abandoned — every finished run advances the trip counter, which also drives
 * the free-refill cooldown). Failed runs pay nothing and never touch best score / best grade.
 */
export function applyPayout(save: SaveData, result: RunResult): SaveData {
  const failed = result.stats.failed !== null || result.grade === 'F';
  const tripsCompleted = save.tripsCompleted + 1;
  if (failed) return { ...save, tripsCompleted };
  const intensity = result.config.intensity;
  return {
    ...save,
    baht: save.baht + Math.max(0, Math.round(finiteOr(result.totalBaht))),
    tripsCompleted,
    bestScore: Math.max(save.bestScore, Math.round(finiteOr(result.total))),
    bestGrade: { ...save.bestGrade, [intensity]: betterGrade(save.bestGrade[intensity], result.grade) },
  };
}
