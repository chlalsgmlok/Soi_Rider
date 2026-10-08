/** HUD-local contracts (the per-frame snapshot itself is HudState in src/core/types/hud.ts). */
import type { Vec2 } from '../../core/types/geometry';
import type { RoadClass } from '../../core/types/world';
import type { TimeOfDay } from '../../core/types/game';
import type { HudState } from '../../core/types/hud';
import type { Tone, UiSfx } from '../../core/events';

export type PopupKind = 'nearMiss' | 'perfect' | 'filter' | 'care' | 'penalty' | 'info';

/** a road segment for the mini-map (world metres) */
export interface MapRoad {
  a: Vec2;
  b: Vec2;
  /** full paved width in metres */
  width: number;
  cls: RoadClass;
}

/** returns the roads within `radius` metres of `center`; called rarely (when the player leaves the cached area) */
export type MapSource = (center: Vec2, radius: number) => readonly MapRoad[];

export interface HudConfig {
  /** gauge full-scale (rounded up to 10 km/h); set from the equipped bike */
  topSpeedKmh: number;
  timeOfDay: TimeOfDay;
  /** Settings.minimap */
  minimap: boolean;
}

export interface HudDeps {
  toast(text: string, tone: Tone, icon?: string): void;
  sfx(name: UiSfx): void;
}

/** every HUD widget: cheap per-frame update that diffs against its own cache */
export interface HudWidget {
  readonly el: HTMLElement;
  update(s: HudState, now: number): void;
}
