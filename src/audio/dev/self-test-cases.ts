import { BIKES } from '../../core/config/bikes';
import type { UiSfx } from '../../core/events';
import type { BikeModelId, VehicleKind } from '../../core/types';
import type { AudioGraph } from '../audio-graph';
import { SFX_NAMES } from '../sfx/registry';
import type { AmbienceLevels, MusicTrack, SfxName } from '../types';

export type CaseGroup = 'sfx' | 'ui' | 'horn' | 'engine' | 'ride' | 'ambience' | 'music';

/** One sound scenario rendered offline by the self-test. */
export interface SelfTestCase {
  name: string;
  group: CaseGroup;
  seconds: number;
  /** schedule the sound at audio time 0 */
  start(g: AudioGraph): void;
  /** per-control-step driver (rendered time `t`), e.g. a throttle profile */
  step?(g: AudioGraph, t: number): void;
  /** needs the 25 ms housekeeping tick (music sequencer, city life) */
  tick?: boolean;
}

const UI_NAMES: readonly UiSfx[] = ['tap', 'hover', 'back', 'buy', 'deny', 'coin', 'stamp', 'ping', 'swoosh', 'equip', 'count'];
const NPC_HORNS: readonly VehicleKind[] = ['sedan', 'taxi', 'pickup', 'van', 'songthaew', 'moto', 'tuktuk', 'bus'];
const TRACKS: readonly MusicTrack[] = ['title', 'garage', 'ride_day', 'ride_night', 'results'];
const LONG_SFX: Partial<Record<SfxName, number>> = {
  gecko: 5.6, temple_bell: 4.6, tuktuk_pass: 3, moto_pass: 2.4, bus_brake: 2.4, cheer: 2.4, raincoat: 2.4, dog: 1.6,
};

const sfxCase = (name: SfxName): SelfTestCase => ({
  name, group: 'sfx', seconds: LONG_SFX[name] ?? 2.2,
  start: (g) => g.sfx.play(name, { intensity: 0.8, combo: 6, speedKmh: 40, side: 'right' }),
});

const uiCase = (name: UiSfx): SelfTestCase => ({ name: `ui:${name}`, group: 'ui', seconds: 1.4, start: (g) => g.sfx.ui(name) });

const hornCase = (kind: VehicleKind): SelfTestCase => ({
  name: `horn:${kind}`, group: 'horn', seconds: 1.6, start: (g) => g.npcHorn(kind, { x: -4, z: 8 }, 'double'),
});

/** idle → full-throttle pull through the gears → roll off (overrun) → part-throttle cruise */
function engineCase(id: BikeModelId): SelfTestCase {
  const bike = BIKES[id];
  let v = 0;
  let last = 0;
  return {
    name: `engine:${id}`, group: 'engine', seconds: 7, tick: true,
    start: (g) => {
      v = 0;
      last = 0;
      g.engine.setModel(id);
      g.engine.set(0, 0, 0.3, 0);
    },
    step: (g, t) => {
      const dt = t - last;
      last = t;
      const th = t < 1 ? 0 : t < 4.4 ? 1 : t < 5.6 ? 0 : 0.35;
      v = Math.max(0, v + (th * bike.accel * (1 - v / bike.topSpeed) - (th > 0 ? 0.3 : 2.4)) * dt);
      g.engine.set(v / bike.topSpeed, th, th * 0.8, t);
    },
  };
}

const rideCase = (name: string, kmh: number, wet: number, skid: number): SelfTestCase => ({
  name: `ride:${name}`, group: 'ride', seconds: 2, start: (g) => g.ride.set(kmh, wet, skid, 0),
});

const bedCase = (key: keyof AmbienceLevels): SelfTestCase => ({
  name: `ambience:${key}`, group: 'ambience', seconds: 5, tick: true, start: (g) => g.beds.set({ [key]: 1 }, 0.3, 0),
});

const thunderCase = (name: string, km: number): SelfTestCase => ({
  name: `thunder:${name}`, group: 'ambience', seconds: 9, start: (g) => g.thunder(km),
});

const musicCase = (track: MusicTrack): SelfTestCase => ({
  name: `music:${track}`, group: 'music', seconds: 7, tick: true, start: (g) => g.music.play(track, 0.05),
});

export const SELF_TEST_CASES: readonly SelfTestCase[] = [
  ...SFX_NAMES.map(sfxCase),
  ...UI_NAMES.map(uiCase),
  { name: 'horn:player_tap', group: 'horn', seconds: 1.2, start: (g) => g.horn.tap() },
  {
    name: 'horn:player_hold', group: 'horn', seconds: 1.6,
    start: (g) => g.horn.set(true),
    step: (g, t) => {
      if (t >= 0.9) g.horn.set(false);
    },
  },
  ...NPC_HORNS.map(hornCase),
  ...(['cub', 'scooter', 'sport'] as const).map(engineCase),
  rideCase('cruise60', 60, 0, 0),
  rideCase('wet40', 40, 1, 0),
  rideCase('skid30', 30, 0, 1),
  ...(['city', 'rain', 'wind', 'night'] as const).map(bedCase),
  thunderCase('near', 0.4),
  thunderCase('far', 6),
  ...TRACKS.map(musicCase),
  { name: 'music:stinger_grade_s', group: 'music', seconds: 5, tick: true, start: (g) => g.music.stinger('grade_s') },
];
