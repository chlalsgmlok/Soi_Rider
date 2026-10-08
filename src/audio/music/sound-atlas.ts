import { Rng } from '../../core/rng';
import { Voice } from '../core/voice';

/** One sound to bake: rendered by `render` on a voice starting at audio time `t`, lasting `seconds`. */
export interface AtlasEntry {
  key: string;
  seconds: number;
  render(v: Voice, t: number): void;
}

interface Slot {
  offset: number;
  seconds: number;
}

export interface SlotPlay {
  /** linear gain (velocity) */
  gain: number;
  /**
   * shorten the baked decay: the slot was baked with a perc envelope ~−40 dB after `baked` s; play it as if it had
   * been rendered with `decay` s. Product of exponentials = an exact shorter exponential.
   */
  decay?: { baked: number; target: number };
  /** start at this playback rate and glide to 1 (a slide up into the note) */
  slideFrom?: number;
  slideSec?: number;
  /** custom gain automation (e.g. khaen breathing); replaces `gain` / `decay` */
  envelope?: (gain: AudioParam, t: number) => void;
}

/** silence between slots so a ringing tail never bleeds into the next sound */
const GAP = 0.03;

/**
 * Procedural instruments baked once into one mono buffer ("sample atlas") with an OfflineAudioContext, then
 * played back as one buffer source + one gain per note. Same sound design as the live recipes at a small
 * fraction of the CPU: a live phin note is ~10 nodes, a slot is 2.
 */
export class SoundAtlas {
  private constructor(readonly buffer: AudioBuffer, private readonly slots: ReadonlyMap<string, Slot>) {}

  static async bake(sampleRate: number, entries: readonly AtlasEntry[], seed = 0xa71a5): Promise<SoundAtlas> {
    const slots = new Map<string, Slot>();
    let at = GAP;
    for (const e of entries) {
      if (slots.has(e.key)) continue;
      slots.set(e.key, { offset: at, seconds: e.seconds });
      at += e.seconds + GAP;
    }
    const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(at * sampleRate)), sampleRate);
    const rng = new Rng(seed);
    for (const e of entries) {
      const slot = slots.get(e.key);
      if (!slot) continue;
      const v = new Voice(ctx, ctx.destination, rng);
      e.render(v, slot.offset);
      v.seal();
    }
    return new SoundAtlas(await ctx.startRendering(), slots);
  }

  has(key: string): boolean {
    return this.slots.has(key);
  }

  /** baked seconds of audio (memory = seconds × sampleRate × 4 bytes) */
  get seconds(): number {
    return this.buffer.duration;
  }

  /** schedule slot `key` at `t` into `dest`; returns false when the key was not baked */
  play(ctx: BaseAudioContext, dest: AudioNode, key: string, t: number, o: SlotPlay): boolean {
    const slot = this.slots.get(key);
    if (!slot) return false;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    const g = ctx.createGain();
    g.gain.value = o.gain;
    if (o.envelope) o.envelope(g.gain, t);
    else if (o.decay && o.decay.target < o.decay.baked - 1e-3) {
      const extra = 1 / (4.6 / Math.max(0.01, o.decay.target) - 4.6 / o.decay.baked);
      g.gain.setValueAtTime(o.gain, t);
      g.gain.setTargetAtTime(0, t, extra);
    }
    if (o.slideFrom && o.slideFrom > 0 && o.slideFrom !== 1) {
      src.playbackRate.setValueAtTime(o.slideFrom, t);
      src.playbackRate.linearRampToValueAtTime(1, t + (o.slideSec ?? 0.06));
    }
    src.connect(g).connect(dest);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    // stop once the shortened tail is ~−55 dB down
    const len = o.decay && !o.envelope ? Math.min(slot.seconds, o.decay.target * 1.25 + 0.03) : slot.seconds;
    src.start(t, slot.offset, len);
    return true;
  }
}
