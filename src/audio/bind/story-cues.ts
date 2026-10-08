import type { GameEvents, Mood } from '../../core/events';
import { clamp } from '../../core/math2d';
import type { PromptId } from '../../core/types';
import { WEATHER_WIND } from '../scene-mood';
import type { SfxName } from '../types';
import { sfx, type AudioCue } from './audio-cue';

/** Pure mappers: mission / story / weather / passenger events → sound cues. */

export function phaseCues(p: GameEvents['mission:phase']): AudioCue[] {
  switch (p.phase) {
    case 'toPickup':
      return p.prev === 'intro' ? [sfx('go')] : [];
    case 'boarding':
      return [sfx('pickup'), sfx('helmet_knock', { delay: 0.9 })];
    case 'complete':
      return [sfx('dropoff'), sfx('coin', { delay: 0.95 }), sfx('coin', { delay: 1.12, pitch: 1.06 })];
    case 'failed':
      return [sfx('fail'), { do: 'duck', amount: 0.75, seconds: 2.4 }];
    case 'intro':
    case 'toDropoff':
    case 'arriving':
      return [];
  }
}

/** a story prompt just opened: the gram ping for care moments (raincoat / mask), silent for routine prompts */
export function promptCues(id: PromptId): AudioCue[] {
  if (id === 'raincoat' || id === 'mask') return [{ do: 'ui', name: 'ping' }, { do: 'duck', amount: 0.35, seconds: 1.6 }];
  return [];
}

export function resolveCues(p: GameEvents['story:resolve']): AudioCue[] {
  if (!p.success) return [];
  if (p.id === 'raincoat') return [sfx('raincoat')];
  if (p.id === 'mask') return [sfx('mask')];
  return [];
}

const MOOD_SFX: Record<Mood, SfxName> = {
  happy: 'yay',
  neutral: 'chat',
  scared: 'gasp',
  angry: 'grumble',
  wet: 'shiver',
  cough: 'cough',
};

/** the passenger behind you reacts (slightly behind-centre pan, per-line pitch so voices vary) */
export const moodCues = (mood: Mood, pitch: number): AudioCue[] => [sfx(MOOD_SFX[mood], { pitch, pan: 0.1, gain: 0.9 })];

/** downpour onset ramps in over the 6 s precursor; clearing up fades out slowly */
export function weatherCues(p: GameEvents['weather:change']): AudioCue[] {
  const rain = clamp(Number.isFinite(p.rain) ? p.rain : 0, 0, 1);
  if (p.to === 'rain') {
    const r = rain > 0 ? rain : 0.8;
    return [{ do: 'ambience', levels: { rain: r, wind: 0.3 + 0.4 * r }, ramp: 6 }];
  }
  if (p.from === 'rain') return [{ do: 'ambience', levels: { rain, wind: WEATHER_WIND[p.to] }, ramp: 10 }];
  return [{ do: 'ambience', levels: { rain, wind: WEATHER_WIND[p.to] }, ramp: 4 }];
}

export const CAMERA_CUES: readonly AudioCue[] = [{ do: 'ui', name: 'swoosh', gain: 0.4 }];
