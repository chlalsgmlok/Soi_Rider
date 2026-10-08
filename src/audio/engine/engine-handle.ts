import type { BikeModelId } from '../../core/types';
import type { EngineControl } from './engine-control';

/**
 * `audio.engine` — usable before the AudioContext exists (first user gesture). Intent (model, started/stopped)
 * is remembered and replayed onto the live engine when audio unlocks.
 *
 * `set(rpm01, throttle, load)`: the first argument is the ROAD SPEED as a fraction of the bike's top speed
 * (speed / topSpeed, 0..1). The per-model drivetrain turns it into engine rpm (4-speed rotary box for the cub,
 * CVT hold for the scooter, 6-speed for the sport) — so pass speed, not a precomputed rpm.
 * throttle 0..1 (input), load 0..1 (≈ throttle × how hard the bike is working: passenger, accelerating).
 */
export class EngineHandle {
  private live: EngineControl | null = null;
  private model: BikeModelId = 'cub';
  /** null = never told: the first set() starts the engine by itself */
  private wanted: boolean | null = null;

  attach(engine: EngineControl | null): void {
    this.live = engine;
    if (!engine) return;
    engine.setModel(this.model);
    if (this.wanted === true) engine.start();
    else if (this.wanted === false) engine.stop();
  }

  set(rpm01: number, throttle: number, load: number): void {
    this.live?.set(rpm01, throttle, load);
  }

  setModel(id: BikeModelId): void {
    this.model = id;
    this.live?.setModel(id);
  }

  /** starter crank + catch */
  start(): void {
    this.wanted = true;
    this.live?.start();
  }

  stop(): void {
    this.wanted = false;
    this.live?.stop();
  }

  /** engine dies (fall) and restarts itself after `seconds` */
  stall(seconds: number): void {
    this.live?.stall(seconds);
  }

  /** current engine rpm 0 (idle) .. 1 (redline) — e.g. for a tachometer */
  get rpm01(): number {
    return this.live?.rpm01 ?? 0;
  }

  get gear(): number {
    return this.live?.gear ?? 0;
  }

  get running(): boolean {
    return this.live?.running ?? false;
  }
}
