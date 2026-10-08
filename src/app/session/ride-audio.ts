import type { BikeStats, PlayerInput, PlayerState, RunConfig, WeatherKind } from '../../core/types';
import { ambienceFor, type AudioEngine, feedRiderAudio, rideTrack } from '../../audio';
import type { RideInput } from '../../player';

/**
 * The ride's sound: the bike's engine + tyres + wind from the bike state every frame (feedRiderAudio), the city
 * ambience of the run and the riding music for its time of day. Story / impact / UI sounds come from bindAudio.
 */
export class RideAudio {
  /** the effective ride input as the PlayerInput feedRiderAudio reads (edge flags unused) */
  private readonly input: PlayerInput = {
    throttle: 0, brake: 0, steer: 0, tuck: false, hornPressed: false, interactPressed: false, cameraPressed: false,
    pausePressed: false, anyPressed: false, device: 'keyboard',
  };
  private running = false;

  constructor(private readonly audio: AudioEngine, private readonly stats: BikeStats, private readonly config: RunConfig) {}

  /** GO: engine on, run ambience, riding music */
  start(weather: WeatherKind, rain: number): void {
    const a = this.audio;
    a.engine.setModel(this.stats.id);
    a.engine.start();
    a.ambience(ambienceFor(this.config.intensity, this.config.timeOfDay, weather, rain), 2.5);
    a.music(rideTrack(this.config.timeOfDay), 2);
    this.running = true;
  }

  /** once per rendered frame while riding; `ride` = what the bike got this step (player or bot) */
  update(state: PlayerState, ride: RideInput, wet: number, passenger: boolean): void {
    if (!this.running) return;
    const i = this.input;
    i.throttle = ride.throttle;
    i.brake = ride.brake;
    i.steer = ride.steer;
    i.tuck = ride.tuck;
    feedRiderAudio(this.audio, { state, stats: this.stats, input: i, wet, passenger });
  }

  /** paused / results: the engine idles down and stops */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.audio.engine.stop();
    this.audio.ride(0, 0, 0);
  }
}
