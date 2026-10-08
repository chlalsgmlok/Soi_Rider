import { RIDE } from '../core/config/bikes';
import { clamp, G, KMH } from '../core/math2d';
import type { BikeStats, PlayerInput, PlayerState } from '../core/types';
import type { AudioEngine } from './audio-engine';

export interface RiderAudioFrame {
  state: PlayerState;
  stats: BikeStats;
  input: PlayerInput;
  /** road wetness 0..1 */
  wet: number;
  /** someone on the back seat (the engine works harder) */
  passenger: boolean;
}

/** slip angle (rad) at which the tyres squeal flat out */
const FULL_SLIP = 0.22;
/** braking deceleration as a fraction of the grip limit where the tyres start to chirp */
const BRAKE_CHIRP = 0.85;

/**
 * One frame of riding → audio: listener at the rider, engine (road speed → rpm through the bike's drivetrain,
 * throttle, load from passenger + acceleration) and ride noise (tyres, wind, spray, squeal when grip runs out or
 * the brakes are at the limit). Allocation-free; call once per rendered frame.
 */
export function feedRiderAudio(audio: AudioEngine, f: RiderAudioFrame): void {
  const { state, stats, input } = f;
  const speed = Math.abs(state.speed);
  const up = !state.fallen;
  const throttle = up ? clamp(input.throttle, 0, 1) : 0;
  const pull = clamp(state.accel / Math.max(0.1, stats.accel), 0, 1);
  const load = clamp(throttle * (f.passenger ? 0.7 : 0.55) + pull * 0.35 + (f.passenger ? 0.1 : 0), 0, 1);
  audio.setListener(state.pos, state.heading);
  audio.engine.set(up ? speed / stats.topSpeed : 0, throttle, load);

  const grip = f.wet > 0.3 ? RIDE.gripWet : RIDE.gripDry;
  const slip = clamp(Math.abs(state.slip) / FULL_SLIP, 0, 1);
  const chirp = speed > 5 && -state.accel > BRAKE_CHIRP * grip * G ? 0.3 : 0;
  audio.ride(speed * KMH, f.wet, up ? Math.max(slip, chirp) : 0);
}
