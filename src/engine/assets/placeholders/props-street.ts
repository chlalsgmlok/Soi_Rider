import type { Group } from 'three';
import { PlaceholderKit } from './kit';

/** street furniture & plants — origin at the footprint centre on the ground, front = +Z */
const one = (name: string, f: (k: PlaceholderKit) => void): Group => {
  const k = new PlaceholderKit(name);
  f(k);
  return k.build();
};

export const propFoodCart = (): Group => one('prop_food_cart', (k) => {
  k.color('Canvas', '#f2c230');
  k.box('', 'Metal', [1.5, 0.9, 0.8], [0, 0.65, 0], 0.05);
  k.box('', 'Glass', [1.3, 0.45, 0.6], [0, 1.33, 0], 0.03);
  k.box('', 'Wood', [1.6, 0.06, 0.9], [0, 1.1, 0], 0.02);
  for (const x of [0.55, -0.55]) k.cyl('', 'Tire', 0.2, 0.2, 0.08, [x, 0.2, -0.38], 'z', 12);
  k.cyl('', 'Metal', 0.02, 0.02, 1.4, [0.7, 2.0, 0.3], 'y', 6);
  k.cyl('', 'Canvas', 0.02, 1.0, 0.35, [0.7, 2.75, 0.3], 'y', 12);
});

export const propStool = (): Group => one('prop_stool', (k) => {
  k.cyl('', 'Plastic', 0.15, 0.13, 0.05, [0, 0.44, 0], 'y', 12);
  for (const [x, z] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]]) k.box('', 'Plastic', [0.04, 0.42, 0.04], [x, 0.21, z], 0.01);
});

export const propTable = (): Group => one('prop_table', (k) => {
  k.box('', 'Chrome', [0.9, 0.04, 0.6], [0, 0.72, 0], 0.01);
  for (const [x, z] of [[0.4, 0.25], [-0.4, 0.25], [0.4, -0.25], [-0.4, -0.25]]) k.cyl('', 'Metal', 0.02, 0.02, 0.7, [x, 0.35, z], 'y', 6);
});

export const propUmbrella = (): Group => one('prop_umbrella', (k) => {
  k.cyl('', 'Metal', 0.025, 0.025, 2.2, [0, 1.1, 0], 'y', 6);
  k.cyl('', 'Canvas', 0.03, 1.25, 0.45, [0, 2.25, 0], 'y', 16);
  k.cyl('', 'Concrete', 0.25, 0.25, 0.12, [0, 0.06, 0], 'y', 10);
});

export const propPotPlant = (): Group => one('prop_pot_plant', (k) => {
  k.cyl('', 'Pot', 0.26, 0.2, 0.42, [0, 0.21, 0], 'y', 12);
  k.ball('', 'Leaf', 0.36, [0, 0.66, 0], [1, 0.8, 1], 10);
  k.ball('', 'Leaf2', 0.24, [0.15, 0.85, 0.05], [1, 0.9, 1], 8);
});

export const propBanana = (): Group => one('prop_banana', (k) => {
  k.color('Leaf', '#6dbb3c');
  k.cyl('', 'Pot', 0.3, 0.24, 0.45, [0, 0.22, 0], 'y', 12);
  k.cyl('', 'Trunk', 0.07, 0.09, 1.2, [0, 1.0, 0], 'y', 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.box('', 'Leaf', [0.3, 0.03, 1.0], [Math.sin(a) * 0.4, 1.75, Math.cos(a) * 0.4], 0.01, [0.6 * Math.cos(a), a, 0]);
  }
});

export const propBougainvillea = (): Group => one('prop_bougainvillea', (k) => {
  k.cyl('', 'Pot', 0.32, 0.25, 0.5, [0, 0.25, 0], 'y', 12);
  k.ball('', 'Leaf', 0.55, [0, 1.0, 0], [1, 0.85, 1], 12);
  for (const [x, y, z] of [[0.3, 1.25, 0.25], [-0.32, 1.1, 0.2], [0.05, 1.42, -0.1], [0.25, 0.85, -0.35], [-0.2, 1.3, -0.3]]) {
    k.ball('', 'Flower', 0.24, [x, y, z], [1, 0.8, 1], 8);
  }
});

export const propPalm = (): Group => one('prop_palm', (k) => {
  k.cyl('', 'Trunk', 0.14, 0.2, 6.5, [0, 3.25, 0], 'y', 10);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.box('', 'Leaf', [0.35, 0.04, 2.4], [Math.sin(a) * 1.0, 6.3, Math.cos(a) * 1.0], 0.01, [0.45, a, 0]);
  }
});

export const propRaintree = (): Group => one('prop_raintree', (k) => {
  k.cyl('', 'Trunk', 0.28, 0.42, 4.2, [0, 2.1, 0], 'y', 10);
  k.ball('', 'Leaf', 3.6, [0, 6.6, 0], [1.25, 0.55, 1.15], 14);
  k.ball('', 'Leaf2', 2.4, [1.8, 6.0, 0.8], [1.2, 0.6, 1.1], 12);
  k.ball('', 'Leaf2', 2.2, [-1.9, 6.2, -0.7], [1.2, 0.6, 1.1], 12);
});

export const propCrates = (): Group => one('prop_crates', (k) => {
  k.color('Plastic', '#3f7fd0');
  k.box('', 'Plastic', [0.5, 0.3, 0.38], [0, 0.15, 0], 0.03);
  k.box('', 'Plastic', [0.5, 0.3, 0.38], [0.02, 0.45, 0.01], 0.03);
  k.box('', 'Plastic', [0.5, 0.3, 0.38], [0.55, 0.15, 0.05], 0.03);
});

export const propIceBox = (): Group => one('prop_ice_box', (k) => {
  k.box('', 'Ice', [0.7, 0.45, 0.45], [0, 0.23, 0], 0.06);
  k.box('', 'Shirt', [0.72, 0.07, 0.47], [0, 0.48, 0], 0.03);
});

export const propAcUnit = (): Group => one('prop_ac_unit', (k) => {
  k.box('', 'Metal', [0.8, 0.55, 0.3], [0, 0.28, 0], 0.04);
  k.cyl('', 'Trim', 0.2, 0.2, 0.02, [0.12, 0.28, 0.155], 'z', 14);
});

export const propSpiritHouse = (): Group => one('prop_spirit_house', (k) => {
  k.color('Wall', '#f4f0e8');
  k.box('', 'Wall', [0.4, 1.2, 0.4], [0, 0.6, 0], 0.03);
  k.box('', 'Wall', [1.0, 0.1, 1.0], [0, 1.25, 0], 0.02);
  k.box('', 'Gold', [0.6, 0.55, 0.6], [0, 1.57, 0], 0.03);
  k.box('', 'Roof', [0.75, 0.08, 0.8], [0.18, 1.98, 0], 0.01, [0, 0, 0.6]);
  k.box('', 'Roof', [0.75, 0.08, 0.8], [-0.18, 1.98, 0], 0.01, [0, 0, -0.6]);
  k.box('', 'Gold', [0.05, 0.4, 0.05], [0, 2.3, 0], 0.01);
  k.ball('', 'Flower', 0.06, [0.25, 1.35, 0.42], [1, 1, 1], 6);
  k.ball('', 'Flower', 0.06, [-0.25, 1.35, 0.42], [1, 1, 1], 6);
});
