import type { ScreenPoint, Vec2 } from './geometry';
import type { MissionPhase, PassengerProfile, WeatherKind } from './game';
import type { CameraMode } from './save';

export type PromptId = 'raincoat' | 'mask' | 'board' | 'dropoff' | 'pickup_hint';

export interface PromptState {
  id: PromptId;
  title: string;
  text: string;
  /** keyboard key label shown in the key cap */
  key: string;
  /** 0..1 time remaining (1 = just opened) */
  progress: number;
}

export interface ClearanceHud {
  /** centimetres, null when not tight (> 30 cm) */
  leftCm: number | null;
  rightCm: number | null;
  /** projected screen anchors in CSS pixels */
  leftScreen: ScreenPoint | null;
  rightScreen: ScreenPoint | null;
}

export interface MinimapState {
  playerPos: Vec2;
  playerHeading: number;
  target: Vec2 | null;
  /** remaining route polyline (world points) */
  route: Vec2[];
}

/** Snapshot pushed from the game to the HUD every frame (HUD throttles DOM writes itself). */
export interface HudState {
  tripNumber: number;
  city: string;
  /** e.g. "SUKHUMVIT" */
  district: string;
  roadName: string;
  phase: MissionPhase;
  /** metres to current target (pickup or dropoff), along the route */
  targetMeters: number;
  /** target bearing relative to the player heading (rad, + = right) */
  targetBearing: number;
  /** pin anchor on screen or null if off-screen */
  targetScreen: ScreenPoint | null;
  speedKmh: number;
  /** seconds until ETA (negative = late) */
  etaLeftSec: number;
  elapsedSec: number;
  /** 0..100 */
  comfort: number;
  passenger: PassengerProfile | null;
  clearance: ClearanceHud;
  combo: number;
  weather: WeatherKind;
  /** 0..1 */
  rain: number;
  prompt: PromptState | null;
  cameraMode: CameraMode;
  counterflow: boolean;
  /** riding against traffic right next to the centre line (tolerated, no penalty) */
  centerline?: boolean;
  onSidewalk: boolean;
  tucking: boolean;
  minimap: MinimapState;
  /**
   * Projected screen anchor of the rider (CSS px) — combo popups rise from here.
   * Optional: the HUD falls back to the clearance anchors, then to the lower screen centre.
   */
  bikeScreen?: ScreenPoint | null;
}
