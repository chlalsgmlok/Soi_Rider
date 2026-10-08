/**
 * Garage selection state: the saved loadout (from SaveData) vs. the live preview the player is composing.
 * Pure bookkeeping + change notification; ownership and slot rules come from src/logic (single source of truth).
 */
import { itemById } from '../../../core/config/catalog';
import type { CatalogItem, Loadout, SaveData } from '../../../core/types/save';
import { owns, unownedItems } from '../../../logic/economy';
import { LOADOUT_SLOTS, itemIdFor, type LoadoutSlot } from '../../../logic/loadout-items';

export type { LoadoutSlot };
export const NICKNAME_LIMIT = 10;

export class GarageModel {
  save: SaveData;
  preview: Loadout;
  private listeners = new Set<() => void>();

  constructor(save: SaveData) {
    this.save = save;
    this.preview = { ...save.loadout };
  }

  on(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of [...this.listeners]) fn();
  }

  /** new save (purchase / equip); the preview is kept */
  setSave(save: SaveData): void {
    this.save = save;
    this.emit();
  }

  /** after equipping: saved loadout becomes the preview */
  commit(save: SaveData): void {
    this.save = save;
    this.preview = { ...save.loadout };
    this.emit();
  }

  select(slot: LoadoutSlot, value: string): void {
    if (this.preview[slot] === value) return;
    this.preview = { ...this.preview, [slot]: value };
    this.emit();
  }

  setNickname(name: string): void {
    if (this.preview.nickname === name) return;
    this.preview = { ...this.preview, nickname: name };
    this.emit();
  }

  revert(): void {
    this.preview = { ...this.save.loadout };
    this.emit();
  }

  owns(id: string): boolean {
    return owns(this.save, id);
  }

  /** catalog items in the preview the player has not bought yet */
  unowned(): CatalogItem[] {
    return unownedItems(this.save, this.preview)
      .map((id) => itemById(id))
      .filter((it): it is CatalogItem => !!it);
  }

  unownedTotal(): number {
    return this.unowned().reduce((sum, it) => sum + it.price, 0);
  }

  /** number of slots (incl. nickname) that differ from the saved loadout */
  changes(): number {
    const saved = this.save.loadout;
    const slots = LOADOUT_SLOTS.filter((s) => this.preview[s] !== saved[s]).length;
    const nick = this.preview.nickname.trim();
    return slots + (nick && nick !== saved.nickname ? 1 : 0);
  }

  dirty(): boolean {
    return this.changes() > 0;
  }

  /** the preview with every not-owned slot put back to the saved value */
  ownedOnly(): Loadout {
    let out: Loadout = { ...this.preview };
    for (const slot of LOADOUT_SLOTS) {
      if (!this.owns(itemIdFor(slot, out[slot]))) out = { ...out, [slot]: this.save.loadout[slot] };
    }
    return out;
  }
}
