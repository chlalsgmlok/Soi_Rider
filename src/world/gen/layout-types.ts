import type { Bounds2, RoadClass, Vec2 } from '../../core/types';

/** Role of a road line in the layout. Majors span the map; sois branch off a parent line. */
export type LineRole = 'main' | 'cross' | 'parallel' | 'cross2' | 'soi' | 'link' | 'yaek';

export interface LineSpec {
  id: number;
  cls: RoadClass;
  role: LineRole;
  /** line this soi branches from (−1 for majors) */
  parent: number;
  /** side of the parent it branches to (+1 / −1), 0 for majors */
  side: number;
  /** position along the parent line (numbering order) */
  along: number;
  skytrain: boolean;
  name: string;
  nameTh: string;
}

export interface SegSpec {
  a: Vec2;
  b: Vec2;
  line: number;
}

/** A landmark lot kept free of sois during layout; filled by gen/lots.ts. */
export interface ReserveSpec {
  /** LotSpec.key */
  key: string;
  rect: Bounds2;
  /** major line the lot fronts */
  line: number;
  /** unit vector from the lot toward that road */
  facing: Vec2;
}

export interface Layout {
  lines: LineSpec[];
  segs: SegSpec[];
  reserves: ReserveSpec[];
  /** line id of the rider's home soi (win stand + spawn) */
  spawnLine: number;
}
