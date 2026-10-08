/**
 * Shared catalog lookups for the menu screens (garage, shop, setup): category copy, the loadout slots each wearable
 * category drives, ownership state and the garage bike spec rows.
 */
import type { CatalogItem, ItemCategory, Loadout, SaveData } from '../../../core/types/save';
import type { BikeModelId } from '../../../core/types/player';
import { BIKES } from '../../../core/config/bikes';
import { owns } from '../../../logic/economy';
import type { IconName } from '../../icons/icon';

export type WearCategory = Exclude<ItemCategory, 'color' | 'fuel'>;
type ItemSlot = 'bike' | 'helmet' | 'outfit' | 'gear';
type ColorSlot = 'bikeColor' | 'helmetColor' | 'outfitColor' | 'gearColor';

export const CATEGORY: Record<ItemCategory, { label: string; en: string; icon: IconName }> = {
  bike: { label: '오토바이', en: 'Bikes', icon: 'bike' },
  helmet: { label: '헬멧', en: 'Helmets', icon: 'helmet' },
  outfit: { label: '옷', en: 'Outfits', icon: 'shirt' },
  gear: { label: '뒷자리', en: 'Rear seat', icon: 'box' },
  color: { label: '색상', en: 'Colours', icon: 'palette' },
  fuel: { label: '연료', en: 'Fuel', icon: 'fuel' },
};

export const WEAR_CATEGORIES: readonly WearCategory[] = ['bike', 'helmet', 'outfit', 'gear'];

/** the loadout slot holding the item ref of each wearable category + the colour slot that paints it */
export const SLOT: Record<WearCategory, { item: ItemSlot; color: ColorSlot; colorLabel: string }> = {
  bike: { item: 'bike', color: 'bikeColor', colorLabel: '바이크 페인트' },
  helmet: { item: 'helmet', color: 'helmetColor', colorLabel: '헬멧 색' },
  outfit: { item: 'outfit', color: 'outfitColor', colorLabel: '옷 색' },
  gear: { item: 'gear', color: 'gearColor', colorLabel: '장비 색' },
};

export const byPrice = (a: CatalogItem, b: CatalogItem): number => a.price - b.price || a.id.localeCompare(b.id);

export const itemsOf = (catalog: readonly CatalogItem[], cat: ItemCategory): CatalogItem[] =>
  catalog.filter((c) => c.category === cat).sort(byPrice);

/** loadout value → catalog id (`bike:cub`); colour slots already hold ids */
export const wearId = (cat: WearCategory, loadout: Loadout): string => `${cat}:${loadout[SLOT[cat].item]}`;

export const isOwned = (save: SaveData, id: string): boolean => owns(save, id);

export type ItemState = 'equipped' | 'owned' | 'locked';

/** colour items count as equipped when any slot wears them */
export function itemState(save: SaveData, item: CatalogItem): ItemState {
  const lo = save.loadout;
  const worn =
    item.category === 'color'
      ? [lo.bikeColor, lo.helmetColor, lo.outfitColor, lo.gearColor].includes(item.id)
      : item.category !== 'fuel' && wearId(item.category, lo) === item.id;
  if (worn) return 'equipped';
  return isOwned(save, item.id) ? 'owned' : 'locked';
}

export interface SpecRow {
  key: 'speed' | 'accel' | 'handling' | 'width';
  label: string;
  /** 0..1 for the bar */
  value: number;
  display: string;
  /** smaller is better (width) */
  inverse?: boolean;
}

export const isBikeId = (ref: string | undefined): ref is BikeModelId => !!ref && ref in BIKES;

export function bikeSpec(id: BikeModelId): SpecRow[] {
  const b = BIKES[id];
  const kmh = b.topSpeed * 3.6;
  return [
    { key: 'speed', label: '최고속도', value: kmh / 120, display: `${Math.round(kmh)}km/h` },
    { key: 'accel', label: '가속', value: b.accel / 5, display: b.accel.toFixed(1) },
    { key: 'handling', label: '핸들링', value: b.handling / 0.75, display: `${Math.round((b.handling * 180) / Math.PI)}°` },
    { key: 'width', label: '차폭', value: (b.mirrorSpan - 0.4) / 0.6, display: `${Math.round(b.mirrorSpan * 100)}cm`, inverse: true },
  ];
}

/** one-line bike summary for shop cards: "최고 82km/h · 차폭 80cm" */
export function bikeLine(id: BikeModelId): string {
  const [speed, , , width] = bikeSpec(id);
  return `최고 ${speed.display} · 차폭 ${width.display}`;
}
