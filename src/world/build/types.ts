import type { Group } from 'three';
import type { Rng } from '../../core/rng';
import type { Circle, OBB, SignalView } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import type { QualitySettings } from '../../engine/quality';

/** What buildCityView needs besides the CityData: quality hints, a forked Rng and preloaded Assets. */
export interface CityViewCtx {
  quality: QualitySettings;
  /** e.g. runRng.fork('cityview') — every procedural choice of the view derives from it */
  rng: Rng;
  /** must have every name from cityAssetNames(data) preloaded */
  assets: Assets;
}

/** Per-frame inputs (Environment + weather + traffic). */
export interface CityFrame {
  /** Environment.night: 0 day … 1 full night */
  night: number;
  /** Environment.lampsOn (defaults to `night`): street lamps, neon, lit windows */
  lamps?: number;
  /** 0..1 road wetness (src/weather) */
  wet: number;
  /** camera world position (LOD / culling distances, viaduct cut-away) */
  camPos: { x: number; y: number; z: number };
  /** what the camera looks at (the rider); lets the BTS viaduct dissolve when it hides them from the diorama camera */
  focus?: { x: number; z: number };
  /** live signal state per signalised node (src/traffic); null = signal dark → blinking amber */
  signal(nodeId: number): SignalView | null;
}

/**
 * A speed hump across a soi carriageway. obb.angle = heading ALONG the road, hw = half width across the road,
 * hl = half depth along it; `height` = crest height above the asphalt (cosine profile).
 */
export interface SpeedBump {
  obb: OBB;
  height: number;
}

/** Draw / build numbers for perf HUDs and reports. */
export interface CityViewStats {
  instances: number;
  templates: number;
  groundChunks: number;
  signs: number;
  /** unique sign artworks / atlas height px (2048 wide) / fill 0..1 / artworks that did not fit */
  signAtlas: { cells: number; height: number; fill: number; misses: number };
  wireSpans: number;
  lightPools: number;
  puddles: number;
  buildMs: number;
  /** build time per stage (ms) */
  phases: Record<string, number>;
}

export interface CityView {
  /** add to the scene once; everything static is inside (≈ a dozen draw calls in total) */
  readonly root: Group;
  /** humps on sois (physics bounce) */
  readonly speedBumps: readonly SpeedBump[];
  /** low spots where rain collects (splash FX, pedestrian splash penalty) */
  readonly puddleSpots: readonly Circle[];
  /** visual ground height (m) at a world point: road 0, sidewalks/plazas raised, medians, humps */
  groundHeight(x: number, z: number): number;
  update(dt: number, frame: CityFrame): void;
  stats(): CityViewStats;
  dispose(): void;
}
