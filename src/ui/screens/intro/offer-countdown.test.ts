import { describe, expect, it, vi } from 'vitest';
import { CountdownClock } from './offer-countdown';

const at = (sec: number): number => 1000 + sec * 1000;

describe('CountdownClock (call choice countdown → auto-accept)', () => {
  it('ticks each whole second down to 0 and expires exactly once, even if frames keep coming', () => {
    const onSecond = vi.fn<(left: number) => void>();
    const onExpire = vi.fn<() => void>();
    const clock = new CountdownClock(3, { onSecond, onExpire });
    expect(clock.frame(at(0))).toBeNull();
    expect(clock.start(at(0))).toBe(true);
    for (let t = 0; t <= 3.5; t += 1 / 60) clock.frame(at(t));
    expect(onSecond.mock.calls.map((c) => c[0])).toEqual([2, 1, 0]);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(clock.running).toBe(false);
    expect(clock.frame(at(9))).toBeNull();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('expires on the first frame past zero after a long stall (tab in background)', () => {
    const onExpire = vi.fn<() => void>();
    const clock = new CountdownClock(20, { onExpire });
    clock.start(at(0));
    clock.frame(at(1));
    const f = clock.frame(at(60));
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(f).toMatchObject({ left: 0, k: 0, sec: 0, urgent: true });
  });

  it('a stopped clock (call accepted) never auto-accepts and cannot be restarted', () => {
    const onExpire = vi.fn<() => void>();
    const clock = new CountdownClock(5, { onExpire });
    clock.start(at(0));
    clock.frame(at(2));
    clock.stop();
    expect(clock.frame(at(10))).toBeNull();
    expect(clock.start(at(10))).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('stopping from inside onSecond prevents the expiry in the same frame', () => {
    const onExpire = vi.fn<() => void>();
    const clock: CountdownClock = new CountdownClock(1, { onSecond: () => clock.stop(), onExpire });
    clock.start(at(0));
    clock.frame(at(2));
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('drains the bar and switches tone: amber below 40 %, coral for the last 5 seconds', () => {
    const clock = new CountdownClock(20, { onExpire: () => undefined });
    clock.start(at(0));
    expect(clock.frame(at(0))).toMatchObject({ k: 1, sec: 20, warn: false, urgent: false });
    expect(clock.frame(at(10))).toMatchObject({ k: 0.5, sec: 10, warn: false, urgent: false });
    expect(clock.frame(at(13))).toMatchObject({ sec: 7, warn: true, urgent: false });
    expect(clock.frame(at(15.5))).toMatchObject({ sec: 5, warn: false, urgent: true });
  });

  it('clamps a zero / negative length to one second', () => {
    const onExpire = vi.fn<() => void>();
    const clock = new CountdownClock(0, { onExpire });
    expect(clock.total).toBe(1);
    clock.start(at(0));
    clock.frame(at(0.5));
    expect(onExpire).not.toHaveBeenCalled();
    clock.frame(at(1));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
