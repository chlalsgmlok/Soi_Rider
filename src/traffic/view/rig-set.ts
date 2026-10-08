import { Group, type Material } from 'three';
import { VEHICLES } from '../../core/config/traffic';
import type { VehicleKind } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import { CharacterRig, HEAD_GEAR, TORSO_GEAR, UMBRELLA } from './character-rig';
import { GlowLayer } from './glow-layer';
import { MotoRig } from './moto-rig';
import { createGlassMaterial, createRigMaterial } from './rig-material';
import { VehicleRig } from './vehicle-rig';

/** car kinds drawn by VehicleRig (motorbikes have their own rigs) */
export const CAR_KINDS: readonly Exclude<VehicleKind, 'moto'>[] = ['taxi', 'sedan', 'van', 'pickup', 'tuktuk', 'bus', 'songthaew'];
/** NPC motorbike models (the moto spec names bike_cub; scooters add variety) */
export const MOTO_MODELS = ['bike_cub', 'bike_scooter'] as const;

/** every model the traffic view instantiates — preload these through Assets */
export function trafficAssetNames(): string[] {
  return [...CAR_KINDS.map((k) => VEHICLES[k].model), ...MOTO_MODELS, 'char_body', ...HEAD_GEAR, ...TORSO_GEAR, UMBRELLA];
}

export interface RigCaps {
  /** per car model */
  cars: number;
  motos: number;
  characters: number;
}

/** All instanced rigs of the traffic view, built once from the preloaded assets. */
export class RigSet {
  readonly root = new Group();
  readonly material: Material;
  readonly glass: Material;
  readonly cars = new Map<VehicleKind, VehicleRig>();
  readonly motos: MotoRig[] = [];
  readonly people: CharacterRig;
  readonly glow = new GlowLayer();

  constructor(assets: Assets, caps: RigCaps) {
    this.root.name = 'traffic_view';
    this.material = createRigMaterial();
    this.glass = createGlassMaterial();
    for (const k of CAR_KINDS) {
      const rig = new VehicleRig(VEHICLES[k].model, assets.shared(VEHICLES[k].model), this.material, this.glass, k === 'bus' ? Math.ceil(caps.cars / 3) : caps.cars);
      rig.addTo(this.root);
      this.cars.set(k, rig);
    }
    for (const name of MOTO_MODELS) {
      const rig = new MotoRig(name, assets.shared(name), this.material, caps.motos);
      rig.addTo(this.root);
      this.motos.push(rig);
    }
    const gear = new Map([...HEAD_GEAR, ...TORSO_GEAR, UMBRELLA].map((n) => [n, assets.shared(n)] as const));
    this.people = new CharacterRig(assets.shared('char_body'), gear, this.material, caps.characters);
    this.people.addTo(this.root);
    this.root.add(this.glow.root);
  }

  begin(): void {
    for (const r of this.cars.values()) r.begin();
    for (const r of this.motos) r.begin();
    this.people.begin();
    this.glow.begin();
  }

  commit(): void {
    for (const r of this.cars.values()) r.commit();
    for (const r of this.motos) r.commit();
    this.people.commit();
    this.glow.commit();
  }

  dispose(): void {
    for (const r of this.cars.values()) r.dispose();
    for (const r of this.motos) r.dispose();
    this.people.dispose();
    this.glow.dispose();
    this.material.dispose();
    this.glass.dispose();
    this.root.removeFromParent();
  }
}
