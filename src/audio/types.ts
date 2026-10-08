import type { Vec2, VehicleKind } from '../core/types';

/** Every one-shot world sound the SfxPlayer knows (UI sounds use `UiSfx` from src/core/events.ts). */
export type SfxName =
  // impacts & bike
  | 'crash' | 'bump' | 'thud_ped' | 'mirror_clack' | 'curb' | 'scrape' | 'skid' | 'splash'
  | 'helmet_knock' | 'shift' | 'starter' | 'backfire'
  // traffic & motion
  | 'whoosh' | 'tuktuk_pass' | 'moto_pass' | 'bus_brake'
  // rewards & mission
  | 'combo' | 'combo_cash' | 'perfect' | 'filter_pass' | 'pickup' | 'dropoff' | 'go' | 'fail' | 'warn'
  | 'coin' | 'stamp' | 'gram_ping'
  // people & care
  | 'cough' | 'gasp' | 'yay' | 'cheer' | 'grumble' | 'shiver' | 'chat' | 'raincoat' | 'mask'
  // city life
  | 'police_whistle' | 'temple_bell' | 'vendor_bell' | 'gecko' | 'dog' | 'camera_shutter';

export interface SfxOpts {
  /** world position: stereo pan + distance attenuation relative to `setListener` */
  pos?: Vec2;
  /** explicit pan −1..1 (ignored when `pos` is given) */
  pan?: number;
  /** linear gain multiplier (default 1) */
  gain?: number;
  /** pitch multiplier (default 1) */
  pitch?: number;
  /** 0..1 how hard / how big (default 0.6) */
  intensity?: number;
  /** combo count for combo-aware sounds (blip pitch, cash-in length) */
  combo?: number;
  /** relative speed for pass-bys / impacts (km/h) */
  speedKmh?: number;
  /** which side a pass-by happens on */
  side?: 'left' | 'right';
  /** start offset in seconds from now */
  delay?: number;
}

/** Resolved parameters a recipe receives (all defaults applied). */
export interface SfxParams {
  intensity: number;
  combo: number;
  speedKmh: number;
  /** −1 left, +1 right, 0 centre */
  side: number;
  pitch: number;
}

export type HornKind = VehicleKind | 'player';
export type HornPattern = 'tap' | 'double' | 'long' | 'angry';

export type MusicTrack = 'title' | 'garage' | 'ride_day' | 'ride_night' | 'results';
export type StingerName = 'grade_s';

/** Ambience bed levels, each 0..1. */
export interface AmbienceLevels {
  /** traffic/city bed density */
  city: number;
  rain: number;
  wind: number;
  /** night insects & geckos, fewer vendors */
  night: number;
}

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

/** Audio time source (seconds on the AudioContext timeline). Overridable for offline rendering. */
export type Clock = () => number;

export interface AudioEngineOptions {
  /** seeds the random city life / horn variation (default fixed) */
  seed?: number;
  volumes?: Partial<Volumes>;
  /** suspend while the tab is hidden (default true) */
  pauseWhenHidden?: boolean;
}

export interface AudioStats {
  state: AudioContextState | 'locked';
  time: number;
  voices: number;
  track: MusicTrack | null;
  rpm01: number;
  gear: number;
  sampleRate: number;
}
