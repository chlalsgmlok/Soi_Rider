import { AudioGraph } from './audio-graph';
import { RealtimeDriver } from './realtime-driver';

type AudioCtor = new (options?: AudioContextOptions) => AudioContext;

/**
 * One live realtime AudioContext with its sound graph and housekeeping driver. Created inside the first user
 * gesture by `AudioEngine.unlock()`; everything else about the game's sound lives in the graph.
 */
export class AudioSession {
  readonly graph: AudioGraph;
  private readonly driver: RealtimeDriver;
  private analyser: AnalyserNode | null = null;

  /** null when the browser has no WebAudio (or refuses to create a context) */
  static create(seed: number, pauseWhenHidden: boolean): AudioSession | null {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    try {
      return new AudioSession(new Ctor({ latencyHint: 'interactive' }), seed, pauseWhenHidden);
    } catch (err) {
      console.warn('[audio] AudioContext unavailable', err);
      return null;
    }
  }

  private constructor(readonly ctx: AudioContext, seed: number, pauseWhenHidden: boolean) {
    // a one-sample silent buffer started inside the gesture fully unlocks iOS Safari
    const kick = ctx.createBufferSource();
    kick.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    kick.connect(ctx.destination);
    kick.start();
    this.graph = new AudioGraph(ctx, seed);
    this.driver = new RealtimeDriver(ctx, this.graph, pauseWhenHidden);
    this.driver.start();
  }

  get running(): boolean {
    return this.ctx.state === 'running';
  }

  resume(): Promise<boolean> {
    if (this.running) return Promise.resolve(true);
    return this.ctx.resume().then(
      () => this.running,
      () => false,
    );
  }

  /** analyser on the final output (created on first use) */
  meter(): AnalyserNode {
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.6;
      this.graph.mixer.output.connect(this.analyser);
    }
    return this.analyser;
  }

  dispose(): void {
    this.driver.stop();
    this.analyser?.disconnect();
    this.graph.dispose();
    this.ctx.close().catch((err: unknown) => console.warn('[audio] close failed', err));
  }
}
