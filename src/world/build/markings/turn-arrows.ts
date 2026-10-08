import type { Connector, Lane } from '../../../core/types';
import type { ArrowKind } from './glyph-painters';

/** lane arrow glyph from the movements its connectors actually allow at the junction ahead */
export function arrowFor(lane: Lane, connectors: readonly Connector[]): ArrowKind {
  const turns = new Set(lane.out.map((id) => connectors[id]?.turn));
  const S = turns.has('straight');
  const L = turns.has('left');
  const R = turns.has('right');
  if (S && L && !R) return 'SL';
  if (S && R && !L) return 'SR';
  if (S && L && R) return lane.index === 0 ? 'SR' : 'SL';
  if (L && R) return 'LR';
  if (L) return 'L';
  if (R) return 'R';
  if (!S && turns.has('uturn')) return 'U';
  return 'S';
}
