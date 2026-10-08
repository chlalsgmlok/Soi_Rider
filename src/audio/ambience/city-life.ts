import type { Rng } from '../../core/rng';
import type { Vec2 } from '../../core/types';
import type { Listener } from '../core/spatial';
import type { AmbienceLevels, HornKind, HornPattern, SfxName, SfxOpts } from '../types';

export interface CityLifeOut {
  sfx(name: SfxName, opts: SfxOpts): void;
  npcHorn(kind: HornKind, pos: Vec2, pattern?: HornPattern): void;
}

interface Happening {
  /** events per second at full weight */
  rate: number;
  weight: (l: AmbienceLevels) => number;
  /** distance band (m) */
  near: number;
  far: number;
  fire: (out: CityLifeOut, pos: Vec2, rng: Rng) => void;
}

const HONKERS: readonly HornKind[] = ['taxi', 'taxi', 'sedan', 'moto', 'moto', 'tuktuk', 'pickup', 'van', 'bus', 'songthaew'];
const PATTERNS: readonly HornPattern[] = ['tap', 'tap', 'double', 'long', 'angry'];

const sound = (name: SfxName, opts: Omit<SfxOpts, 'pos'> = {}) => (out: CityLifeOut, pos: Vec2): void => out.sfx(name, { ...opts, pos });

/** What a Bangkok street sounds like beyond the rider's own lane (rates tuned to be noticed, never busy). */
const HAPPENINGS: readonly Happening[] = [
  { rate: 0.2, weight: (l) => l.city, near: 25, far: 130, fire: (o, p, r) => o.npcHorn(r.pick(HONKERS), p, r.pick(PATTERNS)) },
  { rate: 0.06, weight: (l) => l.city, near: 12, far: 40, fire: sound('moto_pass', { intensity: 0.5 }) },
  { rate: 0.03, weight: (l) => l.city, near: 14, far: 45, fire: sound('tuktuk_pass', { intensity: 0.5 }) },
  { rate: 0.02, weight: (l) => l.city, near: 30, far: 80, fire: sound('bus_brake', { intensity: 0.6 }) },
  { rate: 0.025, weight: (l) => l.city * (1 - l.night) * (1 - l.rain), near: 18, far: 60, fire: sound('vendor_bell') },
  { rate: 0.012, weight: (l) => l.city * (1 - 0.7 * l.rain), near: 40, far: 90, fire: sound('police_whistle') },
  { rate: 0.006, weight: (l) => 0.5 + 0.5 * (1 - l.rain), near: 80, far: 150, fire: sound('temple_bell', { gain: 1.6 }) },
  { rate: 0.02, weight: (l) => 0.4 + l.night, near: 40, far: 120, fire: sound('dog', { gain: 1.4 }) },
  { rate: 0.03, weight: (l) => l.night * (1 - l.rain), near: 12, far: 35, fire: sound('gecko', { gain: 1.3 }) },
];

/**
 * Poisson scheduler for the random life of the city: distant honks, scooters and tuk-tuks passing, a bus
 * hissing at a stop, vendors, a traffic cop, temple bells, soi dogs, tokay geckos at night — each placed at a
 * random bearing and distance around the rider so it pans and fades naturally.
 */
export class CityLife {
  private lastT = -1;

  constructor(private readonly rng: Rng, private readonly listener: Listener, private readonly out: CityLifeOut) {}

  tick(now: number, levels: AmbienceLevels): void {
    const dt = this.lastT < 0 ? 0 : Math.min(0.25, Math.max(0, now - this.lastT));
    this.lastT = now;
    if (dt <= 0) return;
    for (const h of HAPPENINGS) {
      const w = Math.max(0, h.weight(levels));
      if (w > 0 && this.rng.chance(h.rate * w * dt)) h.fire(this.out, this.around(h.near, h.far), this.rng);
    }
  }

  private around(near: number, far: number): Vec2 {
    const a = this.rng.next() * Math.PI * 2;
    const d = near + this.rng.next() * (far - near);
    const p = this.listener.pos;
    return { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
  }
}
