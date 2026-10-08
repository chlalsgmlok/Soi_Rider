import { STARTER_LOADOUT } from '../../core/config/catalog';
import type { BikeModelId, CameraMode, Loadout, OutfitId, QualityPreset, TimeOfDay } from '../../core/types';
import { isQualityPreset } from '../../engine/quality';
import { type Scenario, SCENARIOS } from './autopilot';

export const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const OUTFITS: readonly OutfitId[] = ['tee', 'win_vest', 'hoodie', 'track_jacket', 'aloha'];

/** Player sandbox URL: ?bike &cam &wet &tod &q &autopilot &passenger &outfit &color (see src/sandbox/player.ts). */
export interface ArenaParams {
  bike: BikeModelId;
  cam: CameraMode;
  wet: 0 | 1;
  tod: TimeOfDay;
  quality: QualityPreset;
  scenario: Scenario | null;
  passenger: boolean;
  loadout: Loadout;
}

/** `?autopilot=1` / `true` (or a bare `?autopilot`) runs the default ride, the taxi | van squeeze */
const DEFAULT_SCENARIO = 'squeeze';

function scenarioFor(name: string | null): Scenario | null {
  if (name === null) return null;
  const key = name === '' || name === '1' || name === 'true' ? DEFAULT_SCENARIO : name;
  return Object.hasOwn(SCENARIOS, key) ? SCENARIOS[key] : null;
}

export function arenaParams(search: string): ArenaParams {
  const qs = new URLSearchParams(search);
  const bike = (['cub', 'scooter', 'sport'] as const).find((b) => b === qs.get('bike')) ?? 'scooter';
  const q = qs.get('q');
  return {
    bike,
    cam: (['auto', 'diorama', 'pov'] as const).find((m) => m === qs.get('cam')) ?? 'auto',
    wet: qs.get('wet') === '1' ? 1 : 0,
    tod: TODS.find((t) => t === qs.get('tod')) ?? 'sunset',
    quality: isQualityPreset(q) ? q : 'medium',
    scenario: scenarioFor(qs.get('autopilot')),
    passenger: qs.get('passenger') === '1',
    loadout: {
      ...STARTER_LOADOUT, bike, gear: 'gear_bag', bikeColor: `color:${qs.get('color') ?? 'gram_cyan'}`,
      outfit: OUTFITS.find((o) => o === qs.get('outfit')) ?? 'tee', outfitColor: 'color:thai_tea',
      helmetColor: 'color:jasmine',
    },
  };
}
