import { Box3, type Mesh, type Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ASSET_GROUPS, ASSET_NAMES } from '../asset-names';
import { findMaterials, findNode } from '../material-tools';
import { buildPlaceholder, hasPlaceholder } from './placeholder-registry';

/** size of a subtree (or of the given nodes only) in model space */
function size(root: Object3D, only?: string[]): Vector3 {
  root.updateMatrixWorld(true);
  const box = new Box3();
  const roots = only ? only.map((n) => findNode(root, n)).filter((n): n is Object3D => n !== null) : [root];
  for (const r of roots) box.expandByObject(r);
  return box.getSize(new Vector3());
}

const near = (v: number, want: number, tol = 0.12): void => {
  expect(Math.abs(v - want) / want, `${v.toFixed(2)} vs ${want}`).toBeLessThanOrEqual(tol);
};

const materialNames = (root: Object3D): Set<string> => {
  const out = new Set<string>();
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) for (const x of Array.isArray(m) ? m : [m]) out.add(x.name);
  });
  return out;
};

describe('placeholder registry', () => {
  it('has a stand-in for every asset in the manifest', () => {
    for (const name of ASSET_NAMES) {
      expect(hasPlaceholder(name), name).toBe(true);
      const g = buildPlaceholder(name);
      expect(g?.name).toBe(name);
      expect(g?.userData.placeholder).toBe(true);
    }
    expect(buildPlaceholder('not_an_asset')).toBeNull();
  });
});

describe('vehicles', () => {
  const SPEC: Record<string, [number, number, number]> = {
    veh_taxi: [4.6, 1.76, 1.5], veh_sedan: [4.5, 1.75, 1.45], veh_van: [5.4, 1.9, 2.25], veh_pickup: [5.3, 1.85, 1.8],
    veh_tuktuk: [3.0, 1.4, 1.9], veh_bus: [11.5, 2.5, 3.2], veh_songthaew: [5.0, 1.8, 2.2],
  };
  for (const [name, [L, W, H]] of Object.entries(SPEC)) {
    it(`${name}: nodes, materials and L×W×H`, () => {
      const g = buildPlaceholder(name) as Object3D;
      const wheels = name === 'veh_tuktuk' ? ['wheel_F', 'wheel_RL', 'wheel_RR'] : ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'];
      for (const n of ['body', 'mirror_L', 'mirror_R', 'brake_lights', 'head_lights', ...wheels]) {
        expect(findNode(g, n), `${name}.${n}`).not.toBeNull();
      }
      const mats = materialNames(g);
      for (const m of ['Paint', 'Paint2', 'Glass', 'Tire', 'Light_Head', 'Light_Brake']) expect(mats.has(m), `${name}:${m}`).toBe(true);
      const s = size(g, ['body', ...wheels]);
      near(s.z, L);
      near(s.x, W);
      near(s.y, H, 0.15);
      // model's LEFT is +X
      expect(findNode(g, 'mirror_L')?.position.x).toBeGreaterThan(0);
      expect(findNode(g, wheels[0])?.position.z).toBeGreaterThan(0);
    });
  }
  it('taxi has the roof sign with Sign_Taxi', () => {
    const g = buildPlaceholder('veh_taxi') as Object3D;
    expect(findNode(g, 'taxi_sign')).not.toBeNull();
    expect(findMaterials(g, 'Sign_Taxi').length).toBe(1);
  });
});

describe('bikes', () => {
  const SPEC: Record<string, { L: number; bars: number; seat: number }> = {
    bike_cub: { L: 1.85, bars: 0.66, seat: 0.76 },
    bike_scooter: { L: 1.9, bars: 0.7, seat: 0.78 },
    bike_sport: { L: 2.0, bars: 0.78, seat: 0.82 },
  };
  for (const [name, spec] of Object.entries(SPEC)) {
    it(`${name}: rig nodes under the right parents`, () => {
      const g = buildPlaceholder(name) as Object3D;
      const steer = findNode(g, 'steer') as Object3D;
      expect(steer).not.toBeNull();
      for (const n of ['wheel_F', 'mirror_L', 'mirror_R', 'dash', 'grip_L', 'grip_R', 'headlight']) {
        expect(findNode(steer, n), `${name}: ${n} under steer`).not.toBeNull();
      }
      for (const n of ['frame', 'wheel_R', 'seat_rider', 'seat_pillion', 'foot_L', 'foot_R', 'gear_mount']) {
        expect(findNode(g, n), `${name}.${n}`).not.toBeNull();
      }
      const mats = materialNames(g);
      for (const m of ['Paint', 'Paint2', 'Trim', 'Seat', 'Chrome', 'Tire', 'Light_Head', 'Light_Tail', 'Light_Brake', 'Dash_Screen', 'Plate']) {
        expect(mats.has(m), `${name}:${m}`).toBe(true);
      }
      near(size(g).z, spec.L, 0.1);
      const seat = new Vector3();
      findNode(g, 'seat_rider')?.getWorldPosition(seat);
      near(seat.y, spec.seat, 0.05);
      const gl = new Vector3();
      const gr = new Vector3();
      findNode(g, 'grip_L')?.getWorldPosition(gl);
      findNode(g, 'grip_R')?.getWorldPosition(gr);
      expect(gl.x).toBeGreaterThan(gr.x);
      near(gl.distanceTo(gr) + 0.1, spec.bars, 0.12);
    });
  }
});

describe('characters', () => {
  it('char_body joint chain hips → torso → head / limbs', () => {
    const g = buildPlaceholder('char_body') as Object3D;
    const parentOf = (n: string): string | undefined => findNode(g, n)?.parent?.name;
    expect(parentOf('torso')).toBe('hips');
    expect(parentOf('head')).toBe('torso');
    for (const s of ['L', 'R']) {
      expect(parentOf(`arm_${s}`)).toBe('torso');
      expect(parentOf(`forearm_${s}`)).toBe(`arm_${s}`);
      expect(parentOf(`hand_${s}`)).toBe(`forearm_${s}`);
      expect(parentOf(`thigh_${s}`)).toBe('hips');
      expect(parentOf(`shin_${s}`)).toBe(`thigh_${s}`);
      expect(parentOf(`foot_${s}`)).toBe(`shin_${s}`);
    }
    const hips = new Vector3();
    findNode(g, 'hips')?.getWorldPosition(hips);
    near(hips.y, 0.92, 0.05);
    near(size(g).y, 1.68, 0.06);
    const mats = materialNames(g);
    for (const m of ['Skin', 'Hands', 'Shirt', 'Pants', 'Shoes']) expect(mats.has(m), m).toBe(true);
  });
  it('helmets cover the hair and carry the helmet materials', () => {
    for (const name of ASSET_GROUPS.headwear.filter((n) => n.startsWith('helmet_'))) {
      const g = buildPlaceholder(name) as Object3D;
      expect(findMaterials(g, 'Helmet_Paint').length, name).toBe(1);
      const helmet = new Box3().setFromObject(g);
      const hair = new Box3().setFromObject(buildPlaceholder('hair_short') as Object3D);
      expect(helmet.min.x).toBeLessThanOrEqual(hair.min.x);
      expect(helmet.max.x).toBeGreaterThanOrEqual(hair.max.x);
      expect(helmet.max.y).toBeGreaterThanOrEqual(hair.max.y);
    }
  });
});

describe('buildings and infrastructure', () => {
  it('shophouses: 4 m frontage, spec heights, signboard quad', () => {
    const H: Record<string, number> = { bld_shophouse_2f: 7.5, bld_shophouse_3f: 10.5, bld_shophouse_4f: 13.5 };
    for (const [name, h] of Object.entries(H)) {
      const g = buildPlaceholder(name) as Object3D;
      const s = size(g);
      near(s.x, 4, 0.05);
      near(s.y, h, 0.1);
      expect(findNode(g, 'signboard'), name).not.toBeNull();
      expect(findMaterials(g, 'Sign_Face').length).toBe(1);
      // facade at z = 0, depth behind it (−Z)
      expect(new Box3().setFromObject(g).min.z).toBeLessThan(-8);
    }
  });
  it('traffic light, power pole and lamp expose their runtime nodes', () => {
    const tl = buildPlaceholder('prop_traffic_light') as Object3D;
    for (const n of ['lamp_red', 'lamp_amber', 'lamp_green', 'countdown']) expect(findNode(tl, n), n).not.toBeNull();
    const pole = buildPlaceholder('prop_power_pole') as Object3D;
    for (const n of ['wire_0', 'wire_1', 'wire_2', 'wire_3']) expect(findNode(pole, n), n).not.toBeNull();
    near(size(pole).y, 9, 0.1);
    expect(findNode(buildPlaceholder('prop_street_lamp') as Object3D, 'lamp')).not.toBeNull();
  });
});
