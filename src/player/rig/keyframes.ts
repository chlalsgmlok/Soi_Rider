/** Tiny keyframe helpers for the scripted rig moments (boarding, dismount, falls). Time u is 0..1. */

export const smooth = (t: number): number => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

export const easeOut = (t: number): number => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - (1 - c) * (1 - c);
};

/** 0 → 1 across [a, b] with smoothstep easing */
export const span = (u: number, a: number, b: number): number => smooth((u - a) / (b - a));

/** 0 outside [a, b], a smooth bump peaking at the middle */
export const bump = (u: number, a: number, b: number): number => {
  if (u <= a || u >= b) return 0;
  return Math.sin(((u - a) / (b - a)) * Math.PI);
};

/** piecewise-smooth scalar track: keys sorted by u, [u, value] */
export function track(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [u1, v1] = keys[i];
    if (u <= u1) {
      const [u0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * smooth((u - u0) / (u1 - u0));
    }
  }
  return keys[keys.length - 1][1];
}

/** walk cycle phase helper: legs swing ±amp, `phase` in radians */
export const swing = (phase: number, amp: number): number => Math.sin(phase) * amp;
