import { smoothstep } from '../../core/math2d';
import { def, type SfxDef } from '../sfx/sfx-def';
import { burst, jitterGains, scatter, thump, ticks } from '../sfx/sfx-kit';

/** distance as given by the weather system: ≤ 50 → kilometres, > 50 → metres */
export const thunderKm = (distance: number): number => {
  const d = Number.isFinite(distance) ? Math.abs(distance) : 3;
  return Math.min(12, Math.max(0.1, d > 50 ? d / 1000 : d));
};

/** flash-to-sound gap, compressed for gameplay (real: ~3 s per km) */
export const thunderDelay = (km: number): number => Math.min(3.5, km * 0.9);

/**
 * Thunder for a strike `km` away: close strikes crack and tear before the roll; far ones are a long, dark,
 * low rumble. The roll is several random swells of low-passed brown noise plus a sub boom.
 */
export function thunderDef(km: number): SfxDef {
  const near = 1 - smoothstep(0.3, 4, km);
  const dur = Math.min(7, 3 + km * 0.6);
  return def((v, t) => {
    if (near > 0.25) {
      burst(v, t, 'white', 'highpass', 1800, 0.7, 0.002, 0.25, 0.5 * near);
      const tears = scatter(v, 24, 0, 0.35);
      ticks(v, t, tears, jitterGains(v, tears.length, 0.2 * near, 0.5 * near), 2500, 0.7, 0.02, v.out, 'highpass');
    }
    const roll = v.gain(0, v.out);
    v.noise('brown', t, t + dur + 0.2, v.filter('lowpass', 180 + 900 * near, 0.7, roll));
    const level = 0.55 * (0.4 + 0.6 * near);
    const g = roll.gain;
    g.setValueAtTime(0, t);
    const swells = 3 + Math.floor(v.rng.next() * 3);
    for (let k = 0; k < swells; k++) {
      const at = t + 0.05 + (k / swells) * dur * 0.7 + v.rng.next() * 0.2;
      g.setTargetAtTime(level * (1 - (k / swells) * 0.5) * (0.5 + v.rng.next() * 0.5), at, 0.08);
      g.setTargetAtTime(level * 0.3, at + 0.25, 0.4);
    }
    g.setTargetAtTime(0, t + dur * 0.8, dur * 0.04);
    thump(v, t + 0.02, 48, 30, 1.5, 0.4 * (0.3 + 0.7 * near));
  }, 0.5, 0.6);
}
