import type { DistrictId } from '../core/types';
import type { DistrictDef } from './gen/district-types';
import { KHAOSAN } from './gen/districts/khaosan';
import { SIAM } from './gen/districts/siam';
import { SILOM } from './gen/districts/silom';
import { SUKHUMVIT } from './gen/districts/sukhumvit';
import { YAOWARAT } from './gen/districts/yaowarat';

export type {
  DistrictDef, LotKind, LotSpec, PoiSpec, PoiWhere, PropRecipe, RoadName, LayoutTuning,
} from './gen/district-types';

/** Every playable district: labels (ko/th/en), road names, signage words, palette weights, prop recipes, POI pools. */
export const DISTRICTS: Readonly<Record<DistrictId, DistrictDef>> = {
  sukhumvit: SUKHUMVIT,
  siam: SIAM,
  yaowarat: YAOWARAT,
  khaosan: KHAOSAN,
  silom: SILOM,
};

export const DISTRICT_IDS: readonly DistrictId[] = ['sukhumvit', 'siam', 'yaowarat', 'khaosan', 'silom'];
