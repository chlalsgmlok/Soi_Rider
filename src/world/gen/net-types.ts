import type { Bounds2, RoadEdge, RoadNode } from '../../core/types';
import type { LineSpec } from './layout-types';

/** Road graph under construction (before lanes/connectors exist). */
export interface RoadNet {
  bounds: Bounds2;
  nodes: RoadNode[];
  edges: RoadEdge[];
  /** layout line id per edge */
  edgeLine: number[];
  lines: LineSpec[];
  /** degree-2 main-road nodes where the median is open for U-turns */
  openings: Set<number>;
  /** lane trim per edge end: [2·e] at node a, [2·e + 1] at node b */
  trims: Float64Array;
}

/** the subset of the network the movement rules need (also satisfied by CityData + openings) */
export interface MovementNet {
  nodes: readonly RoadNode[];
  edges: readonly RoadEdge[];
  openings: ReadonlySet<number>;
}
