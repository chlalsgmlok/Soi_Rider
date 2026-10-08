/**
 * Maps GameEvents onto HUD reactions. Returns an unbind function (also removed by bus.offAllOwnedBy(owner)).
 * Gameplay sounds are NOT emitted here (src/audio binds the same events); only UI-specific cues use ui:sfx.
 */
import type { EventBus } from '../../core/events';
import { SCORE } from '../../core/config/scoring';
import type { Hud } from './hud';

export function bindHudToBus(hud: Hud, bus: EventBus): () => void {
  const owner = {};
  bus.on('nearMiss', (e) => hud.popup('nearMiss', `NEAR MISS${e.combo > 1 ? ` ×${e.combo}` : ''} +${e.points}`), owner);
  bus.on(
    'perfectGap',
    (e) => {
      hud.popup('perfect', `PERFECT GAP${e.combo > 1 ? ` ×${e.combo}` : ''} +${e.points}`);
      hud.flash('info', 0.6);
    },
    owner,
  );
  bus.on('filterPass', () => hud.popup('filter', `FILTER +${SCORE.filterPass}`), owner);
  bus.on('toast', (e) => hud.toast(e.text, e.tone, e.icon), owner);
  bus.on('passenger:say', (e) => hud.say(e.text, e.mood), owner);
  bus.on('story:prompt', (p) => hud.prompt(p), owner);
  bus.on(
    'story:resolve',
    (e) => {
      hud.resolvePrompt(e.id, e.success);
      if (e.success && e.id === 'raincoat') hud.popup('care', `RAINCOAT +${SCORE.careRaincoat}`);
      if (e.success && e.id === 'mask') hud.popup('care', `MASK +${SCORE.careMask}`);
    },
    owner,
  );
  bus.on('mission:phase', (e) => hud.phase(e.phase), owner);
  bus.on(
    'collision',
    (e) => {
      if (e.kind === 'mirror') hud.flash('warn', 0.6);
      else if (e.heavy || e.kind === 'body' || e.kind === 'pedestrian') hud.flash('bad', e.heavy ? 1 : 0.7);
    },
    owner,
  );
  bus.on('player:fall', () => hud.flash('bad', 1), owner);
  return () => bus.offAllOwnedBy(owner);
}
