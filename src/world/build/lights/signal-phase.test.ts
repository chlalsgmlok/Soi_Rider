import { describe, expect, it } from 'vitest';
import { approachAxis, CLEARANCE_GUESS, countdownSeconds, signalAspect } from './signal-phase';

describe('signal phase → lamp per approach', () => {
  it('assigns approaches to the ns / ew group by their dominant world axis', () => {
    expect(approachAxis({ x: 0, z: 1 })).toBe('ns');
    expect(approachAxis({ x: 0.2, z: -0.98 })).toBe('ns');
    expect(approachAxis({ x: -1, z: 0 })).toBe('ew');
    expect(approachAxis({ x: 0.9, z: 0.3 })).toBe('ew');
  });

  it('shows green / amber only to the moving group and red to the crossing one', () => {
    expect(signalAspect('ns_green', 'ns')).toBe('green');
    expect(signalAspect('ns_green', 'ew')).toBe('red');
    expect(signalAspect('ns_yellow', 'ns')).toBe('amber');
    expect(signalAspect('ns_yellow', 'ew')).toBe('red');
    expect(signalAspect('ew_green', 'ew')).toBe('green');
    expect(signalAspect('ew_green', 'ns')).toBe('red');
    expect(signalAspect('ew_yellow', 'ew')).toBe('amber');
    expect(signalAspect('all_red', 'ns')).toBe('red');
    expect(signalAspect('all_red', 'ew')).toBe('red');
  });

  it('counts down whole seconds; a red approach waits for the crossing green plus clearance', () => {
    expect(countdownSeconds('ns_green', 'ns', 7.2)).toBe(8);
    expect(countdownSeconds('ns_yellow', 'ns', 1.1)).toBe(2);
    expect(countdownSeconds('ns_green', 'ew', 7.2)).toBe(Math.ceil(7.2 + CLEARANCE_GUESS));
    expect(countdownSeconds('ew_yellow', 'ns', 2.5)).toBe(3);
    expect(countdownSeconds('all_red', 'ew', 0.4)).toBe(1);
    expect(countdownSeconds('ns_green', 'ns', -1)).toBe(0);
  });
});
