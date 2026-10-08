import { gate, sweep } from '../core/envelope';
import type { Voice } from '../core/voice';
import { def, type SfxDef } from './sfx-def';
import { burst, rustle, thump, ticks, tone } from './sfx-kit';

/** Caring for the passenger: poncho out of the seat box, mask handed back, a tourist's photo. */

/** zip-up: ratchet clicks speeding up while the pitch climbs */
function zip(v: Voice, t: number): void {
  const times: number[] = [];
  let at = 0;
  for (let k = 0; k < 26; k++) {
    times.push(at);
    at += 0.02 - 0.0005 * k;
  }
  const f = ticks(v, t, times, [0.35, 0.28], 1800, 3, 0.006);
  sweep(f.frequency, t, 1800, 4200, at);
  tone(v, t + at, 'sine', 3000, 0.0005, 0.02, 0.08);
}

/** plastic poncho unfolded with a crinkle, shaken out, zipped */
const raincoat = def((v, t) => {
  rustle(v, t, 7, 0.85, 0.42, 3400);
  zip(v, t + 0.95);
}, 1.2, 0.08);

/** mask: a little fabric rustle and two elastic snaps over the ears */
const mask = def((v, t) => {
  rustle(v, t, 3, 0.3, 0.28, 2600);
  for (const at of [0.35, 0.62]) {
    thump(v, t + at, 190, 120, 0.04, 0.3);
    burst(v, t + at, 'white', 'highpass', 3000, 0.7, 0.0005, 0.01, 0.2);
  }
}, 0.9, 0.05);

/** tourist snaps a photo: shutter click-clack + tiny wind-on motor */
const cameraShutter = def((v, t) => {
  burst(v, t, 'white', 'bandpass', 4200, 2, 0.0005, 0.02, 0.45);
  tone(v, t, 'triangle', 2600, 0.0005, 0.015, 0.08);
  burst(v, t + 0.07, 'white', 'bandpass', 2600, 2, 0.0005, 0.025, 0.35);
  const motor = v.gain(0, v.out);
  v.osc('sawtooth', 900, t + 0.1, t + 0.3, v.filter('bandpass', 1400, 2, motor));
  gate(motor.gain, t + 0.1, 0.03, 0.02, 0.1, 0.04);
}, 0.3, 0.05);

export const CARE_SFX = { raincoat, mask, camera_shutter: cameraShutter } satisfies Record<string, SfxDef>;
