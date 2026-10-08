import { itemById } from '../core/config/catalog';
import type { ItemCategory, Loadout } from '../core/types';

/** Maps loadout slots to catalog items (docs/GAME_DESIGN.md §2 Garage). Colour items are shared by every colour slot. */
export type LoadoutSlot = Exclude<keyof Loadout, 'nickname'>;

export const LOADOUT_SLOTS: readonly LoadoutSlot[] = [
  'bike', 'bikeColor', 'helmet', 'helmetColor', 'outfit', 'outfitColor', 'gear', 'gearColor',
];

export const NICKNAME_MAX = 12;

export function slotCategory(slot: LoadoutSlot): ItemCategory {
  switch (slot) {
    case 'bike':
    case 'helmet':
    case 'outfit':
    case 'gear':
      return slot;
    default:
      return 'color';
  }
}

/** catalog id for a slot value: `bike:cub`, `helmet:helmet_cat`, colour slots already hold `color:*` ids */
export function itemIdFor(slot: LoadoutSlot, value: string): string {
  const cat = slotCategory(slot);
  return cat === 'color' ? value : `${cat}:${value}`;
}

/** true when the value names an existing catalog item of the slot's category */
export function slotValueValid(slot: LoadoutSlot, value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  return itemById(itemIdFor(slot, value))?.category === slotCategory(slot);
}

/** catalog ids referenced by a loadout, in slot order */
export const loadoutItemIds = (loadout: Loadout): string[] => LOADOUT_SLOTS.map((s) => itemIdFor(s, loadout[s]));

/** returns a copy with one slot replaced; the value must have passed slotValueValid */
export function withSlot(loadout: Loadout, slot: LoadoutSlot, value: string): Loadout {
  return { ...loadout, [slot]: value } as Loadout;
}

/** trims, strips control characters, collapses spaces and limits to NICKNAME_MAX code points */
export function sanitizeNickname(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  const clipped = Array.from(cleaned).slice(0, NICKNAME_MAX).join('').trim();
  return clipped.length > 0 ? clipped : fallback;
}
