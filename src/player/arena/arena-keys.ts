import type { BikeModelId } from '../../core/types';

/** Debug actions of the player sandbox (riding itself goes through engine/Input). */
export interface ArenaKeyActions {
  bike(id: BikeModelId): void;
  rain(): void;
  timeOfDay(): void;
  passenger(): void;
  board(): void;
  dismount(): void;
  fall(): void;
  restart(): void;
}

const KEYS: Readonly<Record<string, (a: ArenaKeyActions) => void>> = {
  Digit1: (a) => a.bike('cub'),
  Digit2: (a) => a.bike('scooter'),
  Digit3: (a) => a.bike('sport'),
  KeyR: (a) => a.rain(),
  KeyN: (a) => a.timeOfDay(),
  KeyP: (a) => a.passenger(),
  KeyB: (a) => a.board(),
  KeyV: (a) => a.dismount(),
  KeyF: (a) => a.fall(),
  KeyT: (a) => a.restart(),
};

/** 1-3 bike · R rain · N time of day · P passenger · B board · V dismount · F fall · T restart; returns unbind */
export function bindArenaKeys(actions: ArenaKeyActions, target: Window = window): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (!e.repeat) KEYS[e.code]?.(actions);
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
