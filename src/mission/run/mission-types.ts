import type { EventBus } from '../../core/events';
import type { Rng } from '../../core/rng';
import type {
  CityQuery, JobOffer, MissionPhase, PassengerProfile, PlayerState, RunConfig, TrafficQuery, Vec2,
} from '../../core/types';
import type { ContactReport } from '../../physics/collision-types';
import type { StyleEvent } from '../../physics/style-events';

/** Live weather as the mission needs it (src/weather `state` maps onto this). */
export interface MissionWeather {
  /** 0..1 rain intensity */
  rain: number;
  /** 0..1 smog density */
  haze: number;
  /** a downpour event is running (build-up included); omitted → derived from `rain` */
  downpour?: boolean;
  /** a haze spike is running; omitted → derived from `haze` against the plan's base haze */
  hazeSpike?: boolean;
}

/** Everything one fixed step of the ride tells the mission (docs/ARCHITECTURE.md PLAY frame order, step 4). */
export interface MissionFrame {
  /** the bike after physics + collision resolution this step */
  player: PlayerState;
  /** interact (E / A / prompt tap) pressed this step */
  interact: boolean;
  /** contacts that started this step (CollisionSystem.resolve) */
  contacts: readonly ContactReport[];
  /** raw StyleSensor detections this step (the mission scores them) */
  style: readonly StyleEvent[];
  /** pedestrians startled without contact this step (TrafficSystem.onPedScare) */
  pedScares?: ReadonlyArray<{ id: number }>;
  weather: MissionWeather;
  /** signals (red-light running) and bus exhaust; null = no traffic */
  traffic: TrafficQuery | null;
}

/**
 * Scripted moments the app plays — the controller only times them. A returned promise holds the phase until it
 * settles (the timer still guarantees the minimum length; a stuck promise is abandoned after a few seconds).
 */
export interface MissionHooks {
  /** RiderRig.setPassenger(p) + RiderRig.board(seconds) + CameraRig.eventShot('boarding', …) */
  board?(passenger: PassengerProfile, seconds: number): Promise<void> | void;
  /** RiderRig.dismount(seconds) + CameraRig.eventShot('dropoff', …) — also when an upset passenger gets off */
  dismount?(passenger: PassengerProfile, seconds: number): Promise<void> | void;
  /** raincoat / mask handed over: RiderRig.setCare(poncho, mask) */
  care?(poncho: boolean, mask: boolean): void;
  /** the run ended (also announced on the bus as 'mission:phase') */
  ended?(phase: 'complete' | 'failed'): void;
}

export interface MissionOptions {
  city: CityQuery;
  config: RunConfig;
  job: JobOffer;
  bus: EventBus;
  hooks?: MissionHooks;
  /** where the rider starts (default: the city's spawn) */
  start?: { pos: Vec2; heading: number };
  /** dialogue stream (default: Rng(config.seed).fork('mission')) */
  rng?: Rng;
  /** key-cap label of the interact control in prompts (E / A / 탭) */
  interactKey?: string;
}

/** Read-only view of the controller the HUD builder and the markers use. */
export interface MissionView {
  readonly phase: MissionPhase;
  readonly passenger: PassengerProfile;
  /** current target point (pickup / drop stop point) or null when none */
  readonly targetPos: Vec2 | null;
}
