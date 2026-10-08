import type { DistrictId } from './world';
import type { Loadout } from './save';

export type TrafficIntensity = 'light' | 'rush' | 'gridlock';
export type TimeOfDay = 'morning' | 'noon' | 'sunset' | 'night';
export type WeatherKind = 'clear' | 'haze' | 'overcast' | 'rain';

export interface WeatherEvent {
  kind: 'downpour' | 'haze_spike';
  /** trip progress fraction (0..1 of route distance to dropoff) at which it starts */
  atProgress: number;
  /** seconds */
  duration: number;
  /** 0..1 */
  intensity: number;
}

export interface WeatherPlan {
  base: Exclude<WeatherKind, 'rain'>;
  /** base haze/smog density 0..1 */
  haze: number;
  events: WeatherEvent[];
}

export type PassengerTrait = 'hurry' | 'nervous' | 'tourist' | 'shopper' | 'regular';

export interface PassengerLook {
  skin: string;
  shirt: string;
  pants: string;
  hair: 'hair_short' | 'hair_long' | 'hair_bun' | 'hat_cap';
  hairColor: string;
}

export interface PassengerProfile {
  id: string;
  name: string;
  /** short origin label e.g. "방콕 직장인", "일본 관광객" */
  origin: string;
  trait: PassengerTrait;
  rating: number;
  look: PassengerLook;
}

export interface JobOffer {
  id: string;
  passenger: PassengerProfile;
  pickupPoi: number;
  dropPoi: number;
  /** estimated route metres (pickup→drop) */
  estMeters: number;
  /** metres from the spawn to the pickup */
  approachMeters: number;
  fareBaht: number;
  /** one-line request shown on the gram card */
  note: string;
}

export interface RunConfig {
  seed: number;
  tripNumber: number;
  intensity: TrafficIntensity;
  timeOfDay: TimeOfDay;
  weather: WeatherPlan;
  district: DistrictId;
  loadout: Loadout;
}

export type MissionPhase = 'intro' | 'toPickup' | 'boarding' | 'toDropoff' | 'arriving' | 'complete' | 'failed';
export type FailReason = 'comfort' | 'falls' | 'timeout' | 'abandon';
export type CareOutcome = 'given' | 'missed' | 'na';

export interface RunStats {
  timeSec: number;
  etaSec: number;
  routeMeters: number;
  falls: number;
  bumps: number;
  mirrorClips: number;
  pedScares: number;
  curbHits: number;
  redLights: number;
  nearMisses: number;
  perfectGaps: number;
  filterPasses: number;
  maxCombo: number;
  stylePoints: number;
  counterflowSec: number;
  sidewalkSec: number;
  raincoat: CareOutcome;
  mask: CareOutcome;
  smoothArrival: boolean;
  landmarkBonus: number;
  finalComfort: number;
  failed: FailReason | null;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface ScoreLine {
  key: 'delivery' | 'time' | 'safety' | 'comfort' | 'style' | 'care' | 'penalty';
  label: string;
  value: number;
  detail: string;
}

export interface RunResult {
  config: RunConfig;
  job: JobOffer;
  stats: RunStats;
  lines: ScoreLine[];
  total: number;
  grade: Grade;
  stars: number;
  fareBaht: number;
  tipBaht: number;
  bonusBaht: number;
  totalBaht: number;
  passengerComment: string;
  newBest: boolean;
}
