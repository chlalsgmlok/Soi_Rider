import type { BikeModelId } from './player';
import type { Grade, TrafficIntensity } from './game';

export type HelmetId = 'helmet_open' | 'helmet_full' | 'helmet_half' | 'helmet_cat';
export type OutfitId = 'tee' | 'win_vest' | 'hoodie' | 'track_jacket' | 'aloha';
export type GearId = 'none' | 'gear_topbox' | 'gear_bag' | 'gear_rack' | 'gear_cushion' | 'gear_backrest' | 'gear_throne';
export type CameraMode = 'auto' | 'diorama' | 'pov';
export type QualityPreset = 'low' | 'medium' | 'high';

export type ItemCategory =
  | 'bike' | 'helmet' | 'outfit' | 'gear' | 'color' | 'fuel';

/** passenger-comfort perk of pillion seat gear (docs/GAME_DESIGN.md §8) */
export interface SeatPerk {
  /** added to the passenger's starting comfort */
  start: number;
  /** multiplier on the smooth-riding comfort recovery */
  recovery: number;
  /** multiplier on jolt penalties (near miss, harsh brake, mirror clip, body bump); < 1 softens them */
  jolt: number;
}

export interface CatalogItem {
  /** globally unique, e.g. "bike:scooter", "color:taxi_pink", "fuel:5" */
  id: string;
  category: ItemCategory;
  name: string;
  price: number;
  /** owned from the start */
  starter: boolean;
  /** colour items */
  hex?: string;
  /** bike / helmet / outfit / gear reference */
  ref?: string;
  /** fuel packs */
  amount?: number;
  desc?: string;
  /** pillion seat gear: comfort perk while riding with a passenger */
  perk?: SeatPerk;
}

export interface Loadout {
  bike: BikeModelId;
  /** colour item ids (CatalogItem.id) */
  bikeColor: string;
  helmet: HelmetId;
  helmetColor: string;
  outfit: OutfitId;
  outfitColor: string;
  gear: GearId;
  gearColor: string;
  nickname: string;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  quality: QualityPreset | 'auto';
  camera: CameraMode;
  minimap: boolean;
  reducedMotion: boolean;
  /** show on-screen touch controls */
  touch: 'auto' | 'on' | 'off';
}

export interface SaveData {
  version: 1;
  baht: number;
  fuel: number;
  owned: string[];
  loadout: Loadout;
  tripsCompleted: number;
  bestScore: number;
  bestGrade: Record<TrafficIntensity, Grade | null>;
  /** trip counter value when the free refill was last used */
  freeRefillAtTrip: number;
  settings: Settings;
}
