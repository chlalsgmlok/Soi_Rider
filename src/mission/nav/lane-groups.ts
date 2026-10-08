import type { CityData } from '../../core/types';

/**
 * Carriageways: the lanes sharing one edge direction, sorted inner (index 0, next to the centre line) → curb.
 * A motorbike may change lanes freely inside its carriageway, so the route search treats neighbours in a group as
 * connected (see lane-search.ts).
 */
export interface LaneGroups {
  /** group index of every lane id */
  readonly groupOf: Int32Array;
  /** lane ids of every group, ordered by Lane.index */
  readonly groups: ReadonlyArray<readonly number[]>;
}

export function buildLaneGroups(data: CityData): LaneGroups {
  const byKey = new Map<number, number>();
  const groups: number[][] = [];
  const groupOf = new Int32Array(data.lanes.length);
  for (const l of data.lanes) {
    const key = l.edge * 2 + (l.forward ? 0 : 1);
    let g = byKey.get(key);
    if (g === undefined) {
      g = groups.length;
      byKey.set(key, g);
      groups.push([]);
    }
    groups[g].push(l.id);
    groupOf[l.id] = g;
  }
  for (const g of groups) g.sort((a, b) => data.lanes[a].index - data.lanes[b].index);
  return { groupOf, groups };
}

/** the lanes of `lane`'s carriageway (itself included), inner → curb */
export const carriageway = (g: LaneGroups, lane: number): readonly number[] => g.groups[g.groupOf[lane]];
