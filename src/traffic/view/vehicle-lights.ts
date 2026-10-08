import { Matrix4, Vector3 } from 'three';
import type { Vehicle } from '../sim/vehicle';
import type { GlowLayer } from './glow-layer';
import type { LampAnchors } from './part-geometry';

const p = new Vector3();
const signC = new Vector3();
const INDICATOR_KEYS = ['Light_Amber', 'Light_Indicator'] as const;
const pool = new Matrix4();
const s = new Matrix4();

/** warm halogen / LED colours (linear, pre-multiplied by a base intensity) */
const HEAD = [2.2, 1.85, 1.3] as const;
const TAIL = [1.6, 0.06, 0.04] as const;
const AMBER = [2.0, 0.85, 0.08] as const;
const SIGN = [1.4, 1.2, 0.85] as const;
/** headlight fans add up in a jam — keep each one faint */
const POOL = [0.34, 0.28, 0.2] as const;

function flareAt(glow: GlowLayer, m: Matrix4, a: Vector3 | null, c: readonly number[], k: number, size: number): void {
  if (!a || k <= 0.01) return;
  p.copy(a).applyMatrix4(m);
  glow.flare(p.x, p.y, p.z, c[0] * k, c[1] * k, c[2] * k, size);
}

function pair(glow: GlowLayer, m: Matrix4, a: LampAnchors | undefined, c: readonly number[], k: number, size: number): void {
  if (!a) return;
  flareAt(glow, m, a.left, c, k, size);
  flareAt(glow, m, a.right, c, k, size);
}

/**
 * Lamp flares and the headlight fan for one car. Head / tail lamps and taxi roof signs glow with the street lamps
 * (dusk, rain, night); brake lamps and indicators always flare when lit.
 */
export function carLights(glow: GlowLayer, m: Matrix4, lamps: ReadonlyMap<string, LampAnchors>, v: Vehicle, lampsOn: number, darkness: number, blink: boolean): void {
  const night = lampsOn;
  pair(glow, m, lamps.get('Light_Head'), HEAD, night * (0.35 + 0.65 * darkness), 0.42 + 0.22 * darkness);
  pair(glow, m, lamps.get('Light_Tail'), TAIL, night * 0.55, 0.42);
  // a sea of brake lights in a night queue; by day only an actual stop flares
  const brake = (v.accel < -0.6 && v.speed > 0.05 ? 0.5 : 0) + (v.braking ? night * 0.8 : 0);
  pair(glow, m, lamps.get('Light_Brake'), TAIL, brake, 0.55);
  if (blink && v.indicator !== 0) {
    for (const key of INDICATOR_KEYS) {
      const a = lamps.get(key);
      if (a) flareAt(glow, m, v.indicator < 0 ? a.left : a.right, AMBER, 0.9, 0.42);
    }
  }
  const sign = lamps.get('Sign_Taxi');
  if (sign && darkness > 0.05) {
    const c = sign.left && sign.right ? signC.copy(sign.left).add(sign.right).multiplyScalar(0.5) : (sign.left ?? sign.right);
    flareAt(glow, m, c, SIGN, night * darkness * 0.6, 0.45 + 0.2 * darkness);
  }
  // headlight fans only once it is properly dark (at dusk they read as smudges on the warm asphalt)
  const fan = Math.max(0, darkness - 0.3) / 0.7;
  if (fan > 0.02) {
    pool.copy(m).multiply(s.makeTranslation(0, 0.035, v.halfLen - 0.25)).multiply(s.makeScale(4.6, 1, 11));
    glow.pool(pool, POOL[0] * fan, POOL[1] * fan, POOL[2] * fan);
  }
}

/** a motorbike's single head lamp (with a short fan) and tail lamp */
export function motoLights(glow: GlowLayer, m: Matrix4, head: Vector3 | null, tail: Vector3 | null, v: Vehicle, lampsOn: number, darkness: number): void {
  flareAt(glow, m, head, HEAD, lampsOn * (0.3 + 0.5 * darkness), 0.35 + 0.2 * darkness);
  flareAt(glow, m, tail, TAIL, lampsOn * 0.5 + (v.accel < -0.6 && v.speed > 0.05 ? 0.5 : 0), 0.35);
  const fan = Math.max(0, darkness - 0.3) / 0.7 * 0.45;
  if (fan > 0.02) {
    pool.copy(m).multiply(s.makeTranslation(0, 0.035, 0.9)).multiply(s.makeScale(2.6, 1, 7));
    glow.pool(pool, POOL[0] * fan, POOL[1] * fan, POOL[2] * fan);
  }
}
