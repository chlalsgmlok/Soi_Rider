import type { EventBus, GameEvents } from '../../core/events';
import { Rng } from '../../core/rng';
import type { Grade, PromptId, VehicleKind } from '../../core/types';
import { playCues, type AudioCue } from './audio-cue';
import type { AudioSink } from './audio-sink';
import {
  collisionCues, comboEndCues, fallCues, filterPassCues, hornCues, nearMissCues, perfectGapCues, RECOVER_CUES,
  RED_LIGHT_CUES, splashCues, warnCues,
} from './ride-cues';
import { CAMERA_CUES, moodCues, phaseCues, promptCues, resolveCues, weatherCues } from './story-cues';

export interface BindAudioOptions {
  /** randomness for NPC horn kinds / voice pitch (default: fixed seed) */
  rng?: Rng;
}

/** who honks when a horn event does not say (Bangkok street mix) */
const HONKERS: ReadonlyArray<readonly [VehicleKind, number]> = [
  ['taxi', 3], ['moto', 3], ['sedan', 2], ['pickup', 1], ['van', 1], ['tuktuk', 1], ['bus', 0.5], ['songthaew', 0.5],
];

/**
 * Wires every GameEvent that should make a sound to the audio engine. Music selection stays with the app
 * (it knows the screen and time of day — see `rideTrack`). Returns an unbind function.
 *  - story prompts ping once when they open (re-emits with a draining `progress` are ignored)
 *  - an S grade fires the `grade_s` stinger together with the results screen's stamp (`ui:sfx` 'stamp')
 */
export function bindAudio(audio: AudioSink, events: EventBus, opts: BindAudioOptions = {}): () => void {
  const owner = {};
  const rng = opts.rng ?? new Rng(0x50125);
  let promptId: PromptId | null = null;
  let promptProgress = 0;
  let pendingGrade: Grade | null = null;

  const play = (cues: readonly AudioCue[]): void => playCues(audio, cues);
  const on = <K extends keyof GameEvents>(type: K, fn: (p: GameEvents[K]) => void): void => {
    events.on(type, fn, owner);
  };
  const honker = (): VehicleKind => rng.weighted(HONKERS, (h) => h[1])[0];

  on('collision', (p) => play(collisionCues(p)));
  on('player:fall', (p) => play(fallCues(p)));
  on('player:recover', () => play(RECOVER_CUES));
  on('nearMiss', (p) => play(nearMissCues(p)));
  on('perfectGap', (p) => play(perfectGapCues(p)));
  on('filterPass', (p) => play(filterPassCues(p)));
  on('combo:end', (p) => play(comboEndCues(p)));
  on('horn', (p) => play(hornCues(p, honker)));
  on('counterflow', (p) => play(warnCues(p.active)));
  on('sidewalk', (p) => play(warnCues(p.active)));
  on('redLight', () => play(RED_LIGHT_CUES));
  on('weather:change', (p) => play(weatherCues(p)));
  on('thunder', (p) => play([{ do: 'thunder', distance: p.distance }]));
  on('splash', (p) => play(splashCues(p)));
  on('story:prompt', (p) => {
    const fresh = p.id !== promptId || p.progress > promptProgress + 0.25;
    promptId = p.id;
    promptProgress = p.progress;
    if (fresh) play(promptCues(p.id));
  });
  on('story:resolve', (p) => {
    promptId = null;
    play(resolveCues(p));
  });
  on('mission:phase', (p) => {
    promptId = null;
    play(phaseCues(p));
  });
  on('passenger:say', (p) => play(moodCues(p.mood, 0.93 + rng.next() * 0.14)));
  on('camera:mode', () => play(CAMERA_CUES));
  on('run:complete', (p) => {
    pendingGrade = p.grade;
  });
  on('ui:sfx', (p) => {
    play([{ do: 'ui', name: p.name }]);
    if (p.name === 'stamp' && pendingGrade === 'S') play([{ do: 'stinger', name: 'grade_s' }]);
    if (p.name === 'stamp') pendingGrade = null;
  });

  return () => events.offAllOwnedBy(owner);
}
