import { Group, Mesh, MeshStandardMaterial, type Object3D, TorusGeometry } from 'three';
import { batchStatic } from '../../../engine/assets/static-batch';
import { isMesh } from '../../../engine/assets/material-guards';
import { PALETTE as P } from '../../../core/config/palette';
import type { Assets } from '../../../engine/assets/assets';
import { setColor, setEmissive } from '../../../engine/assets/material-tools';
import { toonify } from '../../../engine/env/toonify';
import { STREET } from './garage-ground';

interface House {
  asset: string;
  x: number;
  wall: string;
  wall2: string;
  awning: [string, string];
  /** Interior_Light emission (the open shop glows, the neighbours are closing up) */
  inside: number;
  /** Lamp_Glow bulbs under the awning */
  bulbs: number;
}

/** the soi row at night: the rider's own shop (x = 0) between neighbours; facades on z = 0 facing the street (+Z) */
const HOUSES: readonly House[] = [
  { asset: 'bld_shophouse_2f', x: -8.4, wall: P.wallMint, wall2: '#7fbfb1', awning: [P.awningBlue, P.curbWhite], inside: 0.18, bulbs: 0.5 },
  { asset: 'bld_shophouse_3f', x: -4.2, wall: P.wallCream, wall2: '#d8c08f', awning: [P.awningRed, P.curbWhite], inside: 0.3, bulbs: 0.9 },
  { asset: 'bld_shophouse_3f', x: 0, wall: P.wallSalmon, wall2: '#d9917a', awning: [P.awningGreen, P.curbWhite], inside: 0.6, bulbs: 2 },
  { asset: 'bld_shophouse_2f', x: 4.2, wall: P.wallLemon, wall2: '#d9c25a', awning: [P.awningRed, P.curbWhite], inside: 0.22, bulbs: 0.7 },
  { asset: 'bld_shophouse_3f', x: 8.4, wall: P.wallPowder, wall2: '#a7b7d0', awning: [P.awningBlue, P.curbWhite], inside: 0.12, bulbs: 0.4 },
];

/** [asset, x, z, heading, scale, recolour material, colour] */
type Prop = [string, number, number, number, number, string?, string?];
const PROPS: readonly Prop[] = [
  ['prop_pot_plant', -1.62, 0.55, 0.4, 0.78],
  ['prop_pot_plant', 1.66, 0.5, -0.7, 0.72],
  ['prop_banana', -3.05, 0.85, 0.9, 0.85],
  ['prop_bougainvillea', 2.95, 0.75, 2.2, 0.9],
  ['prop_spirit_house', -6.1, 1.35, 0.25, 0.92],
  ['prop_stool', 1.12, 0.32, 0.5, 1, 'Plastic', P.awningRed],
  ['prop_stool', 1.42, 0.62, 1.4, 1, 'Plastic', P.taxiBlue],
  ['prop_crates', 1.05, -0.65, 0.12, 1],
  ['prop_pot_plant', 6.0, 0.6, 1.8, 0.7],
];

/** every model the set instances */
export const GARAGE_SET_ASSETS: readonly string[] = [...new Set([...HOUSES.map((h) => h.asset), ...PROPS.map((p) => p[0]), 'outfit_vest'])];

/** the win vest on a wire hanger, hooked on the shop's left pilaster */
function hungVest(assets: Assets, wire: MeshStandardMaterial): { root: Group; parts: Object3D[] } {
  const root = new Group();
  root.name = 'win_vest_hook';
  const vest = assets.instance('outfit_vest');
  setColor(vest, 'Outfit_Paint', P.taxiOrange);
  vest.position.y = -0.42;
  vest.rotation.x = 0.06;
  const arc = new Mesh(new TorusGeometry(0.17, 0.008, 6, 24, Math.PI), wire);
  arc.position.y = -0.12;
  arc.rotation.z = Math.PI;
  arc.scale.y = 0.45;
  const hook = new Mesh(new TorusGeometry(0.035, 0.007, 6, 16, Math.PI * 1.4), wire);
  hook.position.y = 0.0;
  root.add(vest, arc, hook);
  root.position.set(-1.86, 1.72, 0.2);
  root.rotation.y = 0.18;
  return { root, parts: [vest, arc, hook] };
}

/**
 * The garage backdrop's buildings and clutter: five recoloured shophouses (the rider's own lit up, neighbours closing
 * for the night), potted plants, a banana tree, bougainvillea, the spirit house, stools, crates and the orange win
 * vest hanging by the door — all static, so merged into a handful of draws (shadow proxies for the casters).
 */
export function buildGarageStreet(assets: Assets): { root: Group; dispose(): void } {
  const parts: Object3D[] = [];
  const set = new Group();
  for (const h of HOUSES) {
    const b = assets.instance(h.asset);
    b.position.set(h.x, STREET.curbH, 0);
    setColor(b, 'Wall', h.wall);
    setColor(b, 'Wall2', h.wall2);
    setColor(b, 'Awning_A', h.awning[0]);
    setColor(b, 'Awning_B', h.awning[1]);
    setEmissive(b, 'Interior_Light', '#ffc27a', h.inside);
    setEmissive(b, 'Lamp_Glow', '#ffcf86', h.bulbs);
    setEmissive(b, 'Window', '#ffd59c', h.inside > 0.5 ? 0.5 : 0.1);
    parts.push(b);
  }
  for (const [asset, x, z, heading, scale, matName, color] of PROPS) {
    const o = assets.instance(asset);
    o.position.set(x, STREET.curbH, z);
    o.rotation.y = heading;
    o.scale.setScalar(scale);
    if (matName && color) setColor(o, matName, color);
    parts.push(o);
  }
  const wire = toonify(new MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.35, metalness: 0.8 }));
  const vest = hungVest(assets, wire);
  set.add(...parts, vest.root);
  const root = batchStatic(set, { name: 'garage_street', mergeColors: true, shadowProxy: true, shadowCell: 12 });
  return {
    root,
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        if (!isMesh(o)) return;
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.name === 'Static_Merged') m.dispose();
      });
      for (const o of [...parts, vest.parts[0]]) assets.release(o);
      for (const m of vest.parts.slice(1)) if (m instanceof Mesh) m.geometry.dispose();
      wire.dispose();
    },
  };
}
