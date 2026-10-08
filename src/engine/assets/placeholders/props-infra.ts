import type { Group } from 'three';
import { PlaceholderKit } from './kit';

/** infrastructure props — origin on the ground at the base, front = +Z (faces the road / oncoming traffic) */
const one = (name: string, f: (k: PlaceholderKit) => void): Group => {
  const k = new PlaceholderKit(name);
  f(k);
  return k.build();
};

export const propPowerPole = (): Group => one('prop_power_pole', (k) => {
  k.cyl('', 'Concrete', 0.12, 0.17, 9, [0, 4.5, 0], 'y', 10);
  for (const y of [8.2, 7.4]) k.box('', 'Metal', [1.9, 0.1, 0.1], [0, y, 0], 0.01);
  k.cyl('', 'Metal', 0.28, 0.28, 0.8, [0, 6.4, 0.3], 'y', 10);
  const tips: Array<[number, number]> = [[0.85, 8.32], [-0.85, 8.32], [0.85, 7.52], [-0.85, 7.52]];
  tips.forEach(([x, y], i) => {
    k.cyl('', 'Trim', 0.04, 0.05, 0.12, [x, y - 0.04, 0], 'y', 6);
    k.node(`wire_${i}`, [x, y + 0.04, 0]);
  });
});

export const propStreetLamp = (): Group => one('prop_street_lamp', (k) => {
  k.cyl('', 'Metal', 0.07, 0.11, 8, [0, 4, 0], 'y', 10);
  k.box('', 'Metal', [0.08, 0.08, 1.6], [0, 7.95, 0.75], 0.02);
  k.box('', 'Metal', [0.32, 0.12, 0.55], [0, 7.9, 1.55], 0.04);
  k.node('lamp', [0, 7.8, 1.55]);
  k.box('lamp', 'Lamp_Glow', [0.26, 0.04, 0.45], [0, 7.83, 1.55], 0.01);
});

/** pole on the traffic's left curb facing oncoming traffic (+Z); the arm reaches over the road toward +X */
export const propTrafficLight = (): Group => one('prop_traffic_light', (k) => {
  k.cyl('', 'Metal', 0.09, 0.12, 6, [0, 3, 0], 'y', 10);
  k.box('', 'Metal', [5, 0.12, 0.12], [2.5, 5.7, 0], 0.03);
  k.box('', 'Trim', [0.36, 1.05, 0.3], [4.6, 5.2, 0.05], 0.06);
  const lamps: Array<[string, string, number]> = [['lamp_red', 'Signal_Red', 5.52], ['lamp_amber', 'Signal_Amber', 5.2], ['lamp_green', 'Signal_Green', 4.88]];
  for (const [node, mat, y] of lamps) {
    k.node(node, [4.6, y, 0.21]);
    k.cyl(node, mat, 0.12, 0.12, 0.05, [4.6, y, 0.21], 'z', 14);
  }
  k.node('countdown', [4.05, 5.2, 0.12]);
  k.quad('countdown', 'Sign_Face', 0.5, 0.36, [4.05, 5.2, 0.12]);
});

export const propSoiSign = (): Group => one('prop_soi_sign', (k) => {
  k.color('Paint', '#2457a6');
  k.cyl('', 'Metal', 0.04, 0.04, 2.6, [0, 1.3, 0], 'y', 8);
  k.box('', 'Paint', [1.2, 0.36, 0.05], [0, 2.75, 0], 0.03);
  k.node('sign_face', [0, 2.75, 0.03]);
  k.quad('sign_face', 'Sign_Face', 1.1, 0.28, [0, 2.75, 0.03]);
});

export const propBusStop = (): Group => one('prop_bus_stop', (k) => {
  k.box('', 'Metal', [3.2, 0.08, 1.4], [0, 2.5, 0], 0.03);
  for (const x of [1.45, -1.45]) k.box('', 'Metal', [0.08, 2.5, 0.08], [x, 1.25, -0.55], 0.02);
  k.box('', 'Glass', [3.0, 1.6, 0.04], [0, 1.4, -0.6], 0.01);
  k.box('', 'Metal', [2.6, 0.06, 0.4], [0, 0.48, -0.35], 0.02);
  k.node('sign_face', [1.3, 2.3, 0.72]);
  k.quad('sign_face', 'Sign_Face', 0.5, 0.35, [1.3, 2.3, 0.72]);
});

export const propWinStand = (): Group => one('prop_win_stand', (k) => {
  k.color('Canvas', '#2c56b8').color('Outfit_Paint', '#ff8a2a');
  k.box('', 'Canvas', [2.6, 0.08, 1.6], [0, 2.4, 0], 0.03);
  for (const x of [1.2, -1.2]) for (const z of [0.7, -0.7]) k.box('', 'Metal', [0.06, 2.4, 0.06], [x, 1.2, z], 0.01);
  k.box('', 'Wood', [2.0, 0.08, 0.4], [0, 0.45, -0.45], 0.02);
  for (const x of [-0.6, -0.2, 0.2]) k.box('', 'Outfit_Paint', [0.3, 0.42, 0.04], [x, 1.7, -0.68], 0.03);
  k.node('sign_face', [0, 2.1, 0.82]);
  k.quad('sign_face', 'Sign_Face', 1.0, 0.4, [0, 2.1, 0.82]);
});

export const propBin = (): Group => one('prop_bin', (k) => {
  k.color('Plastic', '#3e9d5a');
  k.cyl('', 'Plastic', 0.28, 0.24, 0.9, [0, 0.45, 0], 'y', 12);
  k.cyl('', 'Trim', 0.3, 0.3, 0.06, [0, 0.93, 0], 'y', 12);
});

export const propBarrier = (): Group => one('prop_barrier', (k) => {
  k.box('', 'Stripe_Red', [0.45, 0.8, 1.2], [0, 0.4, 0], 0.12);
  k.box('', 'Stripe_White', [0.46, 0.2, 1.21], [0, 0.55, 0], 0.05);
});

export const propCone = (): Group => one('prop_cone', (k) => {
  k.color('Plastic', '#ff6a1a');
  k.box('', 'Plastic', [0.4, 0.04, 0.4], [0, 0.02, 0], 0.01);
  k.cyl('', 'Plastic', 0.03, 0.15, 0.7, [0, 0.39, 0], 'y', 12);
  k.cyl('', 'Stripe_White', 0.09, 0.11, 0.12, [0, 0.38, 0], 'y', 12);
});

export const propHydrant = (): Group => one('prop_hydrant', (k) => {
  k.color('Plastic', '#e23c3c');
  k.cyl('', 'Plastic', 0.13, 0.15, 0.7, [0, 0.35, 0], 'y', 12);
  k.ball('', 'Plastic', 0.13, [0, 0.72, 0], [1, 0.8, 1], 10);
  k.cyl('', 'Plastic', 0.06, 0.06, 0.42, [0, 0.5, 0], 'x', 8);
});
