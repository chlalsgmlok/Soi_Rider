import { describe, expect, it } from 'vitest';
import { revealDelta } from './list-scroll';

describe('revealDelta (call list keeps the selected card in view)', () => {
  it('does nothing when the card is inside the view', () => {
    expect(revealDelta(120, 300, 100, 380)).toBe(0);
  });
  it('scrolls down by the overflow below, up by the overflow above', () => {
    expect(revealDelta(300, 420, 100, 380)).toBe(40);
    expect(revealDelta(60, 200, 100, 380)).toBe(-40);
  });
  it('keeps the top visible when the card is taller than the view', () => {
    expect(revealDelta(150, 600, 100, 380)).toBe(50);
  });
});
