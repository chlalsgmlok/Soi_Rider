import { Color, Group } from 'three';
import type { Rng } from '../../../core/rng';
import type { Vec2 } from '../../../core/types';
import type { FxBudget } from '../fx-budget';
import { addScaled, type FxFrame } from '../fx-frame';
import { ParticleLayer } from '../particles/particle-layer';
import { DustMotes } from './dust-motes';
import { Exhaust } from './exhaust';
import { HazeCards } from './haze-cards';

/**
 * Dry-air atmosphere: drifting smog banks (haze days, smog spikes), diesel exhaust puffs (traffic calls
 * `emitExhaust`) and dust motes in low sunbeams.
 */
export class HazeFx {
  readonly root = new Group();
  readonly cards: HazeCards;
  readonly exhaust: Exhaust;
  readonly motes: DustMotes;
  private readonly smoke: ParticleLayer;
  private readonly lit = new Color();

  constructor(budget: FxBudget, rng: Rng, groundHeight: (x: number, z: number) => number) {
    this.root.name = 'weather_haze_fx';
    this.cards = new HazeCards(budget.hazeCards, rng.fork('smog'));
    this.smoke = new ParticleLayer(budget.smoke, 'smoke', 'weather_exhaust');
    this.exhaust = new Exhaust(this.smoke, rng.fork('exhaust'), groundHeight);
    this.motes = new DustMotes(budget.motes, rng.fork('motes'));
    this.root.add(this.cards.mesh, this.smoke.mesh, this.motes.mesh);
  }

  /** live quality change (clamped to what was allocated) */
  setBudget(b: FxBudget): void {
    this.cards.setCount(b.hazeCards);
    this.motes.setCount(b.motes);
    this.smoke.pool.limit = Math.min(this.smoke.pool.capacity, b.smoke);
  }

  /** a puff of soot at a tailpipe; `heading` = direction the smoke leaves along */
  emitExhaust(pos: Vec2, heading: number, strength = 1): void {
    this.exhaust.emit(pos, heading, strength);
  }

  update(f: FxFrame): void {
    this.exhaust.smog = f.state.haze;
    this.cards.update(f);
    this.motes.update(f);
    const l = f.light;
    addScaled(this.lit.copy(l.ambient), l.sun, 0.6).add(l.lampGlow);
    this.smoke.update(f.dt, f.wind.x, f.wind.z, this.lit);
  }

  dispose(): void {
    this.cards.dispose();
    this.smoke.dispose();
    this.motes.dispose();
    this.root.removeFromParent();
  }
}
