/**
 * Vertical layout of the city view (metres). Roads are the datum; everything off the carriageway is raised the way a
 * Bangkok street is: curbs + tiled sidewalks, flush paved aprons on sidewalk-less sois, raised medians, and buildings
 * standing on a plinth at sidewalk height.
 */
export const HEIGHTS = {
  road: 0,
  /** top of a raised sidewalk (curb height) */
  sidewalk: 0.15,
  /** flush paved apron of sois without a raised sidewalk */
  apron: 0.04,
  /** raised median top */
  median: 0.22,
  /** paved lot courts (temples, malls, tower forecourts) — a hair below sidewalks so overlaps never z-fight */
  plaza: 0.14,
  /** park lawns */
  lawn: 0.08,
  /** bare back-lot ground */
  lot: -0.03,
  /** every building's floor (it stands on a plinth reaching below the lot ground) */
  building: 0.15,
} as const;

/** curb stone: width on top and the size of the rounded nose */
export const CURB = { width: 0.22, bevel: 0.035, stripe: 1.0 } as const;

/** gutter strip on the asphalt along every curb */
export const GUTTER_W = 0.34;

/** static geometry is binned into square chunks of this size so every piece stays frustum-cullable */
export const CHUNK = 64;

/** longest single piece of strip geometry (split so a chunk's bounds stay tight) */
export const PIECE = 32;

/** motorbike waiting box painted between the bike stop line (lane end) and the car stop line behind it */
export const BIKE_BOX_DEPTH = 3.2;

/** visual-only continuation of exit roads beyond the playable square */
export const EXIT_EXTENSION = 180;
