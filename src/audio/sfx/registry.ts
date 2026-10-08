import type { SfxName } from '../types';
import { CARE_SFX } from './sfx-care';
import { CITY_SFX } from './sfx-city';
import type { SfxDef } from './sfx-def';
import { IMPACT_SFX } from './sfx-impacts';
import { REWARD_SFX } from './sfx-rewards';
import { TRAFFIC_SFX } from './sfx-traffic';
import { VOICE_SFX } from './sfx-voices';

/** Every world sound by name — the Record type makes a missing or misspelled recipe a compile error. */
export const SFX: Record<SfxName, SfxDef> = {
  ...IMPACT_SFX,
  ...TRAFFIC_SFX,
  ...REWARD_SFX,
  ...VOICE_SFX,
  ...CARE_SFX,
  ...CITY_SFX,
};

export const SFX_NAMES = Object.keys(SFX) as SfxName[];
