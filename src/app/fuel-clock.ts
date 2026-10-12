import type { UI } from '../ui';
import type { SaveKeeper } from './save-keeper';

/**
 * Free fuel refill (docs/GAME_DESIGN.md §11): once a second, apply the refill clock to the live save; when a fuel
 * arrives, persist it and push the new save into every open screen that shows one (title, garage, shop, setup …).
 * Returns a stop function.
 */
export function startFuelClock(saves: SaveKeeper, ui: UI): () => void {
  const id = window.setInterval(() => {
    if (saves.regen(Date.now())) ui.refreshSave(saves.save);
  }, 1000);
  return () => window.clearInterval(id);
}
