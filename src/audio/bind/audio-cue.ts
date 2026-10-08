import type { UiSfx } from '../../core/events';
import type { Vec2 } from '../../core/types';
import type { AmbienceLevels, HornKind, HornPattern, SfxName, SfxOpts, StingerName } from '../types';
import type { AudioSink } from './audio-sink';

/** One thing the sound system should do in reaction to a game event (plain data — the mappers are pure). */
export type AudioCue =
  | { do: 'sfx'; name: SfxName; opts?: SfxOpts }
  | { do: 'ui'; name: UiSfx; gain?: number }
  | { do: 'hornTap' }
  | { do: 'npcHorn'; kind: HornKind; pos: Vec2 | null; pattern?: HornPattern; delay?: number }
  | { do: 'duck'; amount: number; seconds: number }
  | { do: 'muffle'; amount: number; hold: number }
  | { do: 'stall'; seconds: number }
  | { do: 'restart' }
  | { do: 'stinger'; name: StingerName }
  | { do: 'ambience'; levels: Partial<AmbienceLevels>; ramp: number }
  | { do: 'thunder'; distance: number };

export const sfx = (name: SfxName, opts?: SfxOpts): AudioCue => (opts ? { do: 'sfx', name, opts } : { do: 'sfx', name });

export function playCue(a: AudioSink, c: AudioCue): void {
  switch (c.do) {
    case 'sfx':
      a.sfx(c.name, c.opts);
      break;
    case 'ui':
      a.ui(c.name, c.gain);
      break;
    case 'hornTap':
      a.hornTap();
      break;
    case 'npcHorn':
      a.npcHorn(c.kind, c.pos, c.pattern, c.delay);
      break;
    case 'duck':
      a.duck(c.amount, c.seconds);
      break;
    case 'muffle':
      a.muffle(c.amount, c.hold);
      break;
    case 'stall':
      a.engine.stall(c.seconds);
      break;
    case 'restart':
      a.engine.start();
      break;
    case 'stinger':
      a.stinger(c.name);
      break;
    case 'ambience':
      a.ambience(c.levels, c.ramp);
      break;
    case 'thunder':
      a.thunder(c.distance);
      break;
  }
}

export function playCues(a: AudioSink, cues: readonly AudioCue[]): void {
  for (const c of cues) {
    try {
      playCue(a, c);
    } catch (err) {
      console.error(`[audio] cue "${c.do}" failed`, err);
    }
  }
}
