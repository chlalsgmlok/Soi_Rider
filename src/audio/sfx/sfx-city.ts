import { perc } from '../core/envelope';
import { def, type SfxDef } from './sfx-def';
import { bell, burst, thump } from './sfx-kit';

/** Bangkok street life: the traffic cop's whistle, temple bells, a vendor's hand bell. */

/** pea whistle "phreet, phreet, phreeeeet" — the pea rattles the pitch and level */
const policeWhistle = def((v, t, o) => {
  const blasts: ReadonlyArray<readonly [number, number]> = [[0, 0.13], [0.2, 0.13], [0.4, 0.55]];
  const end = t + 1.05;
  const trill = v.gain(0.75, v.out);
  v.osc('square', 27 + v.rng.next() * 6, t, end, v.filter('lowpass', 80, 0.7, v.gain(0.25, trill.gain)));
  const gateGain = v.gain(0, trill);
  const hz = 2950 * o.pitch;
  const whistle = v.osc('sine', hz, t, end, v.gain(0.22, gateGain));
  v.osc('square', 28, t, end, v.filter('lowpass', 90, 0.7, v.gain(hz * 0.045, whistle.frequency)));
  v.noise('white', t, end, v.filter('bandpass', hz, 3, v.gain(0.4, gateGain)));
  const g = gateGain.gain;
  g.setValueAtTime(0, t);
  blasts.forEach(([s, d], k) => {
    whistle.frequency.setValueAtTime(hz * (k === 2 ? 1.03 : 1), t + s);
    g.setValueAtTime(0, t + s);
    g.linearRampToValueAtTime(1, t + s + 0.012);
    g.setValueAtTime(1, t + s + d);
    g.linearRampToValueAtTime(0, t + s + d + 0.03);
  });
}, 2.5, 0.35);

/** large bronze temple bell: beating partial doublets with long decays, mallet strike */
const templeBell = def((v, t, o) => {
  const f0 = 150 * o.pitch;
  const partials: ReadonlyArray<readonly [number, number, number]> = [
    [1, 1, 6], [2.0, 0.6, 4.5], [2.76, 0.45, 3.5], [3.9, 0.3, 2.5], [5.4, 0.2, 1.8], [7.1, 0.12, 1.2],
  ];
  for (const [r, a, d] of partials) {
    const g = v.gain(0, v.out);
    for (const beat of [-0.35, 0.35]) v.osc('sine', f0 * r + beat, t, t + d + 0.1, g);
    perc(g.gain, t, 0.07 * a, 0.004, d);
  }
  burst(v, t, 'white', 'bandpass', 1800, 1, 0.001, 0.05, 0.18);
  thump(v, t, 150, 110, 0.1, 0.1);
}, 4, 0.55);

/** vendor's hand bell: three or four quick rings */
const vendorBell = def((v, t, o) => {
  const n = 3 + (v.rng.chance(0.5) ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const at = t + k * (0.2 + v.rng.next() * 0.04);
    bell(v, at, 2350 * o.pitch * (1 + v.rng.next() * 0.01), 1.41, 1.2, 0.7, 0.12);
    bell(v, at, 3420 * o.pitch, 1, 0.3, 0.45, 0.05);
  }
}, 1.5, 0.3);

export const CITY_SFX = { police_whistle: policeWhistle, temple_bell: templeBell, vendor_bell: vendorBell } satisfies Record<string, SfxDef>;
