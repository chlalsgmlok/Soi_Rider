import { Group, type MeshStandardMaterial, type Object3D, Vector3 } from 'three';
import type { Assets } from '../assets/assets';
import { findMaterials, findNode, setColor } from '../assets/material-tools';
import { batchStatic } from '../assets/static-batch';
import { LightPools } from '../env/light-pools';
import { buildRider } from './lookdev-rider';
import { buildRouteOverlay, buildWires } from './lookdev-overlays';
import { BUILDINGS, MOTOS, PEOPLE, type Placement, POLES, PROPS, VEHICLES } from './lookdev-placements';
import { buildStreetGround } from './street-ground';

export interface LookdevScene {
  root: Group;
  /** the player bike (dynamic) */
  player: Object3D;
  focus: Vector3;
  /** lamps 0..1 → emissives; `dark` (Environment.night) scales the ground light pools */
  setLamps(on: number, dark: number): void;
  /** 0..1 wet road (stand-in for src/weather's wet-road treatment) */
  setWet(wet: number): void;
}

const SIDEWALK_Y = 0.16;
const onWalk = (x: number): number => (Math.abs(x) > 7 ? SIDEWALK_Y : 0);

export function lookdevAssetNames(): string[] {
  const names = new Set<string>(['char_body', 'helmet_open', 'helmet_full', 'helmet_half', 'outfit_vest', 'gear_bag', 'bike_scooter']);
  for (const list of [BUILDINGS, PROPS, POLES, VEHICLES]) for (const [a] of list) names.add(a);
  for (const [b] of MOTOS) names.add(b);
  return [...names];
}

function place(assets: Assets, p: Placement, parent: Group): Object3D {
  const [asset, x, z, heading, colors] = p;
  const o = assets.instance(asset);
  for (const [mat, hex] of Object.entries(colors ?? {})) setColor(o, mat, hex);
  o.position.set(x, onWalk(x), z);
  o.rotation.y = heading;
  parent.add(o);
  return o;
}

export function buildLookdevScene(assets: Assets): LookdevScene {
  const root = new Group();
  root.name = 'lookdev';
  const ground = buildStreetGround();
  root.add(ground.root);

  const statics = new Group();
  for (const p of BUILDINGS) place(assets, p, statics);
  for (const p of PROPS) place(assets, p, statics);
  for (const p of VEHICLES) place(assets, p, statics);
  const poles = POLES.map((p) => place(assets, p, statics));
  MOTOS.forEach(([bike, x, z, h, shirt, helmet], i) => {
    const r = buildRider(assets, {
      bike, bikeColor: ['#2a2d33', '#e23c3c', '#2f6fd6', '#f2f2f0', '#34b04a', '#151821'][i % 6], helmet: i % 2 ? 'helmet_full' : 'helmet_half',
      helmetColor: helmet, shirt, outfit: i === 2 ? 'outfit_vest' : undefined, outfitColor: '#ff8a2a',
    });
    r.position.set(x, 0, z);
    r.rotation.y = h;
    statics.add(r);
  });
  for (const [x, z, h, shirt] of PEOPLE) {
    const c = assets.instance('char_body');
    setColor(c, 'Shirt', shirt);
    c.position.set(x, onWalk(x), z);
    c.rotation.y = h;
    statics.add(c);
  }
  statics.updateMatrixWorld(true);
  const wires = buildWires(poles);
  if (wires) statics.add(wires);
  const lampPos = statics.children
    .map((o) => findNode(o, 'lamp'))
    .filter((n): n is Object3D => n !== null)
    .map((n) => n.getWorldPosition(new Vector3()));
  const batched = batchStatic(statics, { name: 'lookdev_static', mergeColors: true, shadowProxy: true });
  root.add(batched);

  const player = buildRider(assets, {
    bike: 'bike_scooter', bikeColor: '#7fe0b8', helmet: 'helmet_open', helmetColor: '#f2f2f0', shirt: '#f08a6a',
    gear: 'gear_bag', gearColor: '#a0703c',
  });
  const focus = new Vector3(2.4, 0, -3.2);
  player.position.copy(focus);
  player.rotation.y = -0.08;
  root.add(player);

  const route = [new Vector3(2.4, 0, -2), new Vector3(2.0, 0, 3), new Vector3(0.6, 0, 8.5), new Vector3(1.2, 0, 15),
    new Vector3(3.8, 0, 22), new Vector3(5.6, 0, 30)];
  root.add(buildRouteOverlay(route, focus, new Vector3(5.6, SIDEWALK_Y, 31)));

  const pools = new LightPools(64);
  for (const p of lampPos) pools.add(p.setY(onWalk(p.x)), 6, '#ffbf73');
  for (const [asset, x, z] of BUILDINGS) {
    if (asset.startsWith('bld_shophouse') && Math.abs(x) < 12) pools.add(new Vector3(x - Math.sign(x) * 1.5, SIDEWALK_Y, z), 2.3, '#ffb060', 0.6);
  }
  root.add(pools.mesh);

  const byName = (n: string): MeshStandardMaterial[] => findMaterials(root, n);
  const lamps = byName('Lamp_Glow');
  const windows = byName('Window');
  const interior = byName('Interior_Light');
  const heads = byName('Light_Head');
  const tails = byName('Light_Tail');
  const taxiSigns = byName('Sign_Taxi');
  const setLamps = (on: number, dark: number): void => {
    for (const m of lamps) m.emissiveIntensity = 3.2 * on;
    windows.forEach((m, i) => (m.emissiveIntensity = i % 3 === 1 ? 0 : 1.4 * on));
    for (const m of interior) m.emissiveIntensity = 1.1 + 1.9 * on;
    for (const m of heads) m.emissiveIntensity = 1.2 + 3 * on;
    for (const m of tails) m.emissiveIntensity = 0.6 + 2.2 * on;
    for (const m of taxiSigns) m.emissiveIntensity = 0.5 + 1.8 * on;
    pools.intensity = 0.42 * on * Math.min(1, dark * 1.25);
  };
  const dry = ground.asphalt.color.clone();
  const soaked = dry.clone().multiplyScalar(0.55);
  const setWet = (wet: number): void => {
    ground.asphalt.roughness = 0.88 - 0.62 * wet;
    ground.asphalt.color.lerpColors(dry, soaked, wet);
  };
  return { root, player, focus, setLamps, setWet };
}
