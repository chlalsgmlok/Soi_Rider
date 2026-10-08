import type { Group, Material, Matrix4 } from 'three';
import type { Circle, CityData } from '../../core/types';
import type { LightPools } from '../../engine/env/light-pools';
import { btsLine } from './bts/bts-line';
import { BtsTrains } from './bts/bts-train';
import type { CityHeights } from './heights';
import { buildLightPools } from './lights/light-spots';
import { SignalCountdown } from './lights/signal-countdown';
import { SignalLights } from './lights/signal-lights';
import type { SignGlow } from './signs/sign-build';
import type { TemplateLibrary } from './templates/template-library';
import type { CityFrame } from './types';
import { Puddles } from './wet/puddles';

export interface DynamicsInput {
  data: CityData;
  matrices: readonly Matrix4[];
  templates: TemplateLibrary;
  heights: CityHeights;
  glows: readonly SignGlow[];
  puddleSpots: readonly Circle[];
  cityMaterial: Material;
}

/** Everything in the city view that changes per frame: signals + countdowns, BTS trains, night pools, rain puddles. */
export class CityDynamics {
  readonly signals: SignalLights;
  readonly countdown: SignalCountdown;
  readonly trains: BtsTrains | null;
  readonly pools: LightPools;
  readonly puddles: Puddles;

  constructor(root: Group, I: DynamicsInput) {
    this.signals = new SignalLights(I.data, I.matrices, I.templates);
    root.add(this.signals.group);
    this.countdown = new SignalCountdown(this.signals.matrices, I.templates);
    if (this.countdown.mesh) root.add(this.countdown.mesh);
    const line = btsLine(I.data.placements);
    this.trains = line ? new BtsTrains(line, I.templates.get('bts_train').geometry, I.cityMaterial) : null;
    if (this.trains) root.add(this.trains.mesh);
    this.pools = buildLightPools(I.data, I.matrices, I.templates, I.heights, I.glows);
    root.add(this.pools.mesh);
    this.puddles = new Puddles(I.puddleSpots);
    root.add(this.puddles.mesh);
  }

  update(dt: number, time: number, f: CityFrame, lamps: number): void {
    this.signals.update(time, f.signal);
    this.countdown.update(this.signals.states);
    this.trains?.update(dt);
    this.pools.intensity = 0.42 * lamps * Math.min(1, f.night * 1.25) * (1 + 0.7 * f.wet);
    this.puddles.setWet(f.wet);
  }

  dispose(): void {
    this.signals.dispose();
    this.countdown.dispose();
    this.trains?.dispose();
    this.pools.dispose();
    this.puddles.dispose();
  }
}
