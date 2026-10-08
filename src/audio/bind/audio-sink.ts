import type { UiSfx } from '../../core/events';
import type { Vec2 } from '../../core/types';
import type { AmbienceLevels, HornKind, HornPattern, SfxName, SfxOpts, StingerName } from '../types';

/** The slice of `AudioEngine` that the game-event bindings drive (lets tests record calls with a fake). */
export interface AudioSink {
  readonly engine: {
    start(): void;
    stall(seconds: number): void;
  };
  sfx(name: SfxName, opts?: SfxOpts): void;
  ui(name: UiSfx, gain?: number): void;
  hornTap(): void;
  npcHorn(kind: HornKind, pos: Vec2 | null, pattern?: HornPattern, delay?: number): void;
  thunder(distance: number): void;
  ambience(levels: Partial<AmbienceLevels>, rampSec?: number): void;
  duck(amount: number, seconds: number): void;
  muffle(amount: number, holdSec?: number): void;
  stinger(name: StingerName): void;
}
