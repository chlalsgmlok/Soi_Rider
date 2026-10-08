import type { JobOffer, RunResult, TimeOfDay, TrafficIntensity, WeatherPlan } from './game';
import type { CatalogItem, Loadout, SaveData, Settings } from './save';
import type { DistrictId } from './world';

/** Screen contracts between src/ui (DOM overlays) and src/app (state machine + 3D backdrops). */
export type ScreenId = 'boot' | 'title' | 'garage' | 'shop' | 'setup' | 'intro' | 'hud' | 'pause' | 'results' | 'settings';
export type Transition = 'wipe' | 'fade' | 'none';

export interface Forecast {
  seed: number;
  tripNumber: number;
  district: DistrictId;
  districtLabel: string;
  timeOfDay: TimeOfDay;
  weather: WeatherPlan;
  /** one-line Korean summary e.g. "노을 · 맑음, 오후 늦게 소나기 가능성 45%" */
  summary: string;
  rerollsLeft: number;
}

export interface BuyResult {
  ok: boolean;
  reason?: 'owned' | 'funds' | 'unknown';
  save: SaveData;
}

export interface BootProps {
  /** 0..1, updated through ScreenHandle.update */
  progress: number;
  label: string;
}

export interface TitleProps {
  save: SaveData;
  onStart(): void;
  onGarage(): void;
  onShop(): void;
  onSettings(): void;
}

/** Garage panel docks RIGHT (max 460 px); the left side stays transparent for the 3D turntable. */
export interface GarageProps {
  save: SaveData;
  catalog: CatalogItem[];
  /** live preview of an unsaved selection (3D turntable updates) */
  onPreview(loadout: Loadout): void;
  onEquip(loadout: Loadout): SaveData;
  onBuy(itemId: string): BuyResult;
  onBack(): void;
  onShop(): void;
  /** rotate turntable by drag delta (radians) */
  onRotate(delta: number): void;
}

export interface ShopProps {
  save: SaveData;
  catalog: CatalogItem[];
  onBuy(itemId: string): BuyResult;
  onBack(): void;
}

export interface SetupProps {
  save: SaveData;
  forecast: Forecast;
  onReroll(): Forecast | null;
  /** called when the highlighted intensity changes (3D backdrop can react) */
  onIntensity(intensity: TrafficIntensity): void;
  onGo(intensity: TrafficIntensity): void;
  onBack(): void;
  onBuyFuel(itemId: string): BuyResult;
  /** true when fuel = 0 and the free refill can be claimed */
  freeRefillAvailable: boolean;
  onFreeRefill(): SaveData;
}

/** Phone (gram app) overlay; the 3D scene behind shows the rider at the win stand. */
export interface IntroProps {
  tripNumber: number;
  nickname: string;
  districtLabel: string;
  timeOfDay: TimeOfDay;
  weather: WeatherPlan;
  offers: JobOffer[];
  poiName(poiId: number): string;
  secondsToChoose: number;
  onAccept(offerId: string): void;
}

export interface PauseProps {
  onResume(): void;
  onRestart(): void;
  onSettings(): void;
  onQuit(): void;
}

export interface ResultsProps {
  result: RunResult;
  /** save AFTER payout */
  save: SaveData;
  onNext(): void;
  onGarage(): void;
  onTitle(): void;
}

export interface SettingsProps {
  settings: Settings;
  onChange(settings: Settings): void;
  onBack(): void;
}

export interface ScreenPropsMap {
  boot: BootProps;
  title: TitleProps;
  garage: GarageProps;
  shop: ShopProps;
  setup: SetupProps;
  intro: IntroProps;
  hud: Record<string, never>;
  pause: PauseProps;
  results: ResultsProps;
  settings: SettingsProps;
}
