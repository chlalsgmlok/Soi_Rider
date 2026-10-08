import { Object3D, Vector3 } from 'three';
import type { Assets } from '../assets/assets';
import { findNode, setColor } from '../assets/material-tools';
import { fitSleeves } from '../assets/outfit-sleeves';

export interface RiderLook {
  bike: string;
  bikeColor: string;
  helmet: string;
  helmetColor: string;
  shirt: string;
  pants?: string;
  skin?: string;
  outfit?: string;
  outfitColor?: string;
  gear?: string;
  gearColor?: string;
}

const tmp = new Vector3();

function attach(assets: Assets, body: Object3D, node: string, asset: string): Object3D | null {
  const parent = findNode(body, node);
  if (!parent) return null;
  const part = assets.instance(asset);
  parent.add(part);
  return part;
}

/**
 * A rider seated on a bike in a simple riding pose — look-dev stand-in for src/player's RiderRig so the
 * diorama reads like mockup 03 (helmet, shirt, bike colours, optional rear gear).
 */
export function buildRider(assets: Assets, look: RiderLook): Object3D {
  const root = new Object3D();
  root.name = 'lookdev_rider';
  const bike = assets.instance(look.bike);
  setColor(bike, 'Paint', look.bikeColor);
  root.add(bike);
  bike.updateMatrixWorld(true);

  const body = assets.instance('char_body');
  setColor(body, 'Shirt', look.shirt);
  setColor(body, 'Pants', look.pants ?? '#3a4f78');
  if (look.skin) {
    setColor(body, 'Skin', look.skin);
    setColor(body, 'Hands', look.skin);
  }
  const seat = findNode(bike, 'seat_rider');
  const hipsY = findNode(body, 'hips')?.position.y ?? 0.92;
  if (seat) seat.getWorldPosition(tmp);
  else tmp.set(0, 0.78, -0.14);
  body.position.set(tmp.x, tmp.y - hipsY + 0.04, tmp.z);
  pose(body);
  root.add(body);

  const helmet = attach(assets, body, 'head', look.helmet);
  if (helmet) setColor(helmet, 'Helmet_Paint', look.helmetColor);
  if (look.outfit) {
    const outfit = attach(assets, body, 'torso', look.outfit);
    // hoodie / track jacket sleeves follow the posed arms (they share the outfit's materials, so recolour first)
    if (outfit && look.outfitColor) setColor(outfit, 'Outfit_Paint', look.outfitColor);
    if (outfit) fitSleeves(outfit, body);
  }
  if (look.gear) {
    const mount = findNode(bike, 'gear_mount');
    const gear = assets.instance(look.gear);
    if (look.gearColor) setColor(gear, 'Gear_Paint', look.gearColor);
    if (mount) mount.add(gear);
    else bike.add(gear);
  }
  return root;
}

function rot(body: Object3D, node: string, x: number, y = 0, z = 0): void {
  findNode(body, node)?.rotation.set(x, y, z);
}

function pose(body: Object3D): void {
  rot(body, 'torso', 0.22);
  rot(body, 'head', -0.12);
  for (const [side, s] of [['L', 1], ['R', -1]] as const) {
    rot(body, `thigh_${side}`, -1.25, 0, s * 0.12);
    rot(body, `shin_${side}`, 1.15);
    rot(body, `foot_${side}`, 0.1);
    rot(body, `arm_${side}`, -1.0, 0, -s * 0.12);
    rot(body, `forearm_${side}`, -0.45);
  }
}
