import type { AmbienceLevels, AudioEngine } from '../../audio';

/** the sound bed behind a menu: the title's busy junction, or the garage's quiet night soi */
export type MenuMood = 'street' | 'garage';

const LEVELS: Readonly<Record<MenuMood, AmbienceLevels>> = {
  street: { city: 0.45, rain: 0, wind: 0.06, night: 0.2 },
  garage: { city: 0.2, rain: 0, wind: 0.03, night: 0.75 },
};

export function menuAmbience(audio: AudioEngine, mood: MenuMood): void {
  audio.ambience(LEVELS[mood], 2);
}
