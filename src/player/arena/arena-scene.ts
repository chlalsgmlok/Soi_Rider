import { Group, type MeshStandardMaterial, type Object3D, Vector3 } from 'three';
import { VEHICLES } from '../../core/config/traffic';
import type { Assets } from '../../engine/assets/assets';
import { findMaterials, findNode, setColor, setEmissive } from '../../engine/assets/material-tools';
import { batchStatic } from '../../engine/assets/static-batch';
import { LightPools } from '../../engine/env/light-pools';
import { buildWires } from '../../engine/lookdev/lookdev-overlays';
import { BUILDINGS, MOTOS, type Placement, POLES, PROPS } from '../../engine/lookdev/lookdev-placements';
import { buildRider } from '../../engine/lookdev/lookdev-rider';
import { buildStreetGround } from '../../engine/lookdev/street-ground';
import type { StaticTraffic } from '../../physics/testing/static-traffic';
import { riderRigAssetNames } from '../rig/rig-assets';
import { ARENA_MOTOS, ARENA_PEOPLE, ARENA_VEHICLES, ROAD_HALF, SIDEWALK_Y } from './arena-layout';

export interface ArenaScene {
  root: Group;
  /** street lamps / windows (Environment.lampsOn) and how dark it is (Environment.night) */
  setLamps(on: number, dark: number): void;
  /** 0..1 wet asphalt */
  setWet(wet: number): void;
  /** move nudged motos / pedestrians to their simulated poses */
  sync(): void;
}

const onWalk = (x: number): number => (Math.abs(x) > ROAD_HALF ? SIDEWALK_Y : 0);

export function arenaAssetNames(): string[] {
  const names = new Set<string>(riderRigAssetNames());
  for (const list of [BUILDINGS, PROPS, POLES]) for (const [a] of list) names.add(a);
  for (const v of ARENA_VEHICLES) names.add(VEHICLES[v.kind].model);
  for (const [b] of MOTOS) names.add(b);
  return [...names];
}

function place(assets: Assets, [asset, x, z, heading, colors]: Placement, parent: Group): Object3D {
  const o = assets.instance(asset);
  for (const [mat, hex] of Object.entries(colors ?? {})) setColor(o, mat, hex);
  o.position.set(x, onWalk(x), z);
  o.rotation.y = heading;
  parent.add(o);
  return o;
}

/** batch one movable object in its own frame so it costs a few draws but can still be moved */
function movable(o: Object3D, name: string): Group {
  const g = batchStatic(o, { name, mergeColors: true });
  const holder = new Group();
  holder.add(g);
  return holder;
}

/** builds the arena visuals and fills `traffic` with its standing vehicles, motos and pedestrians */
export function buildArena(assets: Assets, traffic: StaticTraffic): ArenaScene {
  const root = new Group();
  root.name = 'player_arena';
  const ground = buildStreetGround();
  root.add(ground.root);

  const statics = new Group();
  for (const p of BUILDINGS) place(assets, p, statics);
  for (const p of PROPS) place(assets, p, statics);
  const poles = POLES.map((p) => place(assets, p, statics));
  for (const v of ARENA_VEHICLES) {
    const spec = VEHICLES[v.kind];
    traffic.addVehicle(spec, v.x, v.z, v.heading, { paint: v.paint, queued: true });
    const o = place(assets, [spec.model, v.x, v.z, v.heading, { Paint: v.paint, Paint2: v.paint2 }], statics);
    setEmissive(o, 'Light_Brake', '#ff2b1c', 2.2); // everyone is standing on the brakes
  }
  statics.updateMatrixWorld(true);
  const wires = buildWires(poles);
  if (wires) statics.add(wires);
  const lampPos = statics.children
    .map((o) => findNode(o, 'lamp'))
    .filter((n): n is Object3D => n !== null)
    .map((n) => n.getWorldPosition(new Vector3()));
  root.add(batchStatic(statics, { name: 'arena_static', mergeColors: true, shadowProxy: true }));

  const dynamic: Array<[Object3D, { pos: { x: number; z: number }; heading: number }]> = [];
  for (const [bike, x, z, h, shirt, helmet] of ARENA_MOTOS) {
    const agent = traffic.addVehicle({ ...VEHICLES.moto, model: bike }, x, z, h, { queued: true });
    const rider = buildRider(assets, { bike, bikeColor: ['#2a2d33', '#e23c3c', '#2f6fd6', '#f2f2f0', '#34b04a'][agent.id % 5],
      helmet: agent.id % 2 ? 'helmet_full' : 'helmet_half', helmetColor: helmet, shirt });
    setEmissive(rider, 'Light_Brake', '#ff2b1c', 2.4);
    const m = movable(rider, `moto_${agent.id}`);
    root.add(m);
    dynamic.push([m, agent]);
  }
  for (const [x, z, h, shirt] of ARENA_PEOPLE) {
    const ped = traffic.addPedestrian(x, z, h);
    const body = assets.instance('char_body');
    setColor(body, 'Shirt', shirt);
    const m = movable(body, `ped_${ped.id}`);
    m.position.y = onWalk(x);
    root.add(m);
    dynamic.push([m, ped]);
  }

  const pools = new LightPools(64);
  for (const p of lampPos) pools.add(p.setY(onWalk(p.x)), 6, '#ffbf73');
  root.add(pools.mesh);
  const byName = (n: string): MeshStandardMaterial[] => findMaterials(root, n);
  const lamps = byName('Lamp_Glow');
  const windows = byName('Window');
  const interior = byName('Interior_Light');
  const heads = byName('Light_Head');
  const tails = byName('Light_Tail');
  const taxiSigns = byName('Sign_Taxi');
  const dry = ground.asphalt.color.clone();
  const soaked = dry.clone().multiplyScalar(0.55);
  return {
    root,
    setLamps(on, dark) {
      for (const m of lamps) m.emissiveIntensity = 3.2 * on;
      windows.forEach((m, i) => (m.emissiveIntensity = i % 3 === 1 ? 0 : 1.4 * on));
      for (const m of interior) m.emissiveIntensity = 1.1 + 1.9 * on;
      for (const m of heads) m.emissiveIntensity = 1.2 + 3 * on;
      for (const m of tails) m.emissiveIntensity = 0.6 + 2.2 * on;
      for (const m of taxiSigns) m.emissiveIntensity = 0.5 + 1.8 * on;
      pools.intensity = 0.42 * on * Math.min(1, dark * 1.25);
    },
    setWet(wet) {
      ground.asphalt.roughness = 0.88 - 0.62 * wet;
      ground.asphalt.color.lerpColors(dry, soaked, wet);
    },
    sync() {
      for (const [o, a] of dynamic) {
        o.position.x = a.pos.x;
        o.position.z = a.pos.z;
        o.rotation.y = a.heading;
      }
    },
  };
}
