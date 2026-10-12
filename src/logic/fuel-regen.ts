import { FUEL_REGEN_CAP, FUEL_REGEN_MINUTES } from '../core/config/catalog';
import type { SaveData } from '../core/types';

/** one fuel refills every FUEL_REGEN_MINUTES while the tank holds less than FUEL_REGEN_CAP (docs/GAME_DESIGN.md §11) */
export const FUEL_REGEN_MS = FUEL_REGEN_MINUTES * 60_000;

/**
 * Applies the free refill clock at `now` (ms since epoch), counting time the game was closed. The clock runs only
 * while fuel < FUEL_REGEN_CAP; bought fuel may exceed the cap but never regenerates past it. Returns the SAME save
 * object when nothing changed so callers can skip a write.
 */
export function regenFuel(save: SaveData, now: number): SaveData {
  if (save.fuel >= FUEL_REGEN_CAP) return save;
  if (save.fuelRegenAt > now) return { ...save, fuelRegenAt: now }; // device clock wound back
  const since = now - save.fuelRegenAt;
  const ticks = Math.floor(since / FUEL_REGEN_MS);
  if (ticks <= 0) return save;
  const fuel = Math.min(FUEL_REGEN_CAP, save.fuel + ticks);
  const fuelRegenAt = fuel >= FUEL_REGEN_CAP ? now : save.fuelRegenAt + ticks * FUEL_REGEN_MS;
  return { ...save, fuel, fuelRegenAt };
}

/** ms until the next free fuel, or null when the tank is at (or above) the cap */
export function fuelRegenLeftMs(save: SaveData, now: number): number | null {
  if (save.fuel >= FUEL_REGEN_CAP) return null;
  const since = Math.max(0, now - save.fuelRegenAt);
  return FUEL_REGEN_MS - (since % FUEL_REGEN_MS);
}

/** the refill clock starts when a trip takes a full tank below the cap */
export function startRegenClock(before: SaveData, after: SaveData, now: number): SaveData {
  return before.fuel >= FUEL_REGEN_CAP && after.fuel < FUEL_REGEN_CAP ? { ...after, fuelRegenAt: now } : after;
}

/** "29:59" */
export function fmtRegen(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
