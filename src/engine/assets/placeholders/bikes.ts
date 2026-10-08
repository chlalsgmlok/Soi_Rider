import type { Group } from 'three';
import { PALETTE as P } from '../../../core/config/palette';
import { PlaceholderKit } from './kit';

type BikeStyle = 'cub' | 'scooter' | 'sport';

interface BikeShape {
  style: BikeStyle;
  L: number;
  bars: number;
  mirrorSpan: number;
  seat: number;
  wheelbase: number;
  r: number;
}

const SHAPES: Record<BikeStyle, BikeShape> = {
  cub: { style: 'cub', L: 1.85, bars: 0.66, mirrorSpan: 0.76, seat: 0.76, wheelbase: 1.24, r: 0.29 },
  scooter: { style: 'scooter', L: 1.9, bars: 0.7, mirrorSpan: 0.8, seat: 0.78, wheelbase: 1.28, r: 0.27 },
  sport: { style: 'sport', L: 2.0, bars: 0.78, mirrorSpan: 0.86, seat: 0.82, wheelbase: 1.38, r: 0.31 },
};

/** bike_* stand-in: frame, steer (fork, front wheel, bars, mirrors, dash, grips), rear wheel and rig empties */
function bike(name: string, s: BikeShape): Group {
  const k = new PlaceholderKit(name).color('Paint', P.taxiPink).color('Paint2', '#f4f0e8');
  const { r, wheelbase: wb, seat } = s;
  const fz = wb / 2;
  const head: [number, number, number] = [0, 0.92 + (s.style === 'sport' ? 0.06 : 0), fz - 0.15];

  k.node('frame');
  if (s.style === 'cub') {
    k.box('frame', 'Paint', [0.4, 0.55, 0.12], [0, 0.66, fz - 0.24], 0.06);
    k.box('frame', 'Trim', [0.3, 0.06, 0.42], [0, 0.32, 0.02], 0.02);
    k.box('frame', 'Paint', [0.3, 0.34, 0.8], [0, 0.58, -0.32], 0.12);
  } else if (s.style === 'scooter') {
    k.box('frame', 'Paint', [0.46, 0.7, 0.2], [0, 0.6, fz - 0.24], 0.1);
    k.box('frame', 'Trim', [0.36, 0.08, 0.5], [0, 0.3, 0.05], 0.03);
    k.box('frame', 'Paint', [0.36, 0.4, 0.86], [0, 0.56, -0.35], 0.14);
  } else {
    k.box('frame', 'Paint', [0.34, 0.24, 0.5], [0, 0.94, 0.16], 0.1);
    k.box('frame', 'Trim', [0.3, 0.34, 0.42], [0, 0.5, 0.05], 0.05);
    k.box('frame', 'Paint2', [0.22, 0.14, 0.5], [0, 0.88, -0.62], 0.05);
    k.cyl('frame', 'Chrome', 0.04, 0.04, 0.7, [0, 0.72, -0.05], 'z', 8);
  }
  k.box('frame', 'Seat', [0.28, 0.1, 0.66], [0, seat - 0.04, -0.28], 0.05);
  k.box('frame', 'Paint2', [0.2, 0.05, 0.4], [0, r * 2 + 0.04, -fz + 0.02], 0.02);
  k.box('frame', 'Light_Tail', [0.14, 0.06, 0.05], [0, seat - 0.12, -s.L / 2 + 0.06], 0.02);
  k.box('frame', 'Light_Brake', [0.1, 0.04, 0.04], [0, seat - 0.19, -s.L / 2 + 0.05], 0.01);
  k.quad('frame', 'Plate', 0.18, 0.12, [0, seat - 0.3, -s.L / 2 + 0.04], [0.3, Math.PI, 0]);
  k.cyl('frame', 'Chrome', 0.035, 0.045, 0.5, [-0.14, 0.3, -0.42], 'z', 8);

  k.node('wheel_R', [0, r, -fz]);
  k.cyl('wheel_R', 'Tire', r, r, 0.11, [0, r, -fz], 'x', 16);
  k.cyl('wheel_R', 'Chrome', r * 0.42, r * 0.42, 0.12, [0, r, -fz], 'x', 10);

  k.node('steer', head);
  k.cyl('steer', 'Chrome', 0.025, 0.025, head[1] - r, [0.07, (head[1] + r) / 2, (head[2] + fz) / 2], 'y', 6);
  k.cyl('steer', 'Chrome', 0.025, 0.025, head[1] - r, [-0.07, (head[1] + r) / 2, (head[2] + fz) / 2], 'y', 6);
  k.box('steer', 'Paint2', [0.14, 0.05, 0.36], [0, r * 2 + 0.03, fz], 0.02);
  k.box('steer', 'Paint', [0.2, 0.18, 0.16], [0, head[1] + 0.02, head[2] + 0.06], 0.06);
  k.box('steer', 'Light_Head', [0.12, 0.09, 0.04], [0, head[1] + 0.01, head[2] + 0.15], 0.03);
  k.cyl('steer', 'Trim', 0.016, 0.016, s.bars, [0, head[1] + 0.13, head[2] - 0.04], 'x', 8);
  if (s.style === 'cub') k.box('steer', 'Chrome', [0.3, 0.2, 0.22], [0, head[1] - 0.08, head[2] + 0.3], 0.03);
  k.node('wheel_F', [0, r, fz], 'steer');
  k.cyl('wheel_F', 'Tire', r, r, 0.1, [0, r, fz], 'x', 16);
  k.cyl('wheel_F', 'Chrome', r * 0.42, r * 0.42, 0.11, [0, r, fz], 'x', 10);
  k.node('dash', [0, head[1] + 0.12, head[2] + 0.02], 'steer');
  k.quad('dash', 'Dash_Screen', 0.14, 0.08, [0, head[1] + 0.12, head[2] + 0.02], [Math.PI / 3, Math.PI, 0]);
  k.node('headlight', [0, head[1] + 0.01, head[2] + 0.18], 'steer');
  for (const [side, sx] of [['L', 1], ['R', -1]] as const) {
    const gx = sx * (s.bars / 2 - 0.05);
    k.node(`grip_${side}`, [gx, head[1] + 0.13, head[2] - 0.04], 'steer');
    k.cyl(`grip_${side}`, 'Seat', 0.022, 0.022, 0.1, [gx, head[1] + 0.13, head[2] - 0.04], 'x', 8);
    const mx = sx * (s.bars / 2 - 0.1);
    k.node(`mirror_${side}`, [mx, head[1] + 0.14, head[2] - 0.02], 'steer');
    const hx = sx * (s.mirrorSpan / 2 - 0.05);
    k.cyl(`mirror_${side}`, 'Chrome', 0.008, 0.008, 0.24, [(mx + hx) / 2, head[1] + 0.25, head[2] - 0.02], 'y', 6);
    k.ball(`mirror_${side}`, 'Trim', 0.06, [hx, head[1] + 0.37, head[2] - 0.02], [1, 0.75, 0.35], 10);
  }

  k.node('seat_rider', [0, seat, -0.14]);
  k.node('seat_pillion', [0, seat + 0.03, -0.52]);
  const pegY = s.style === 'sport' ? 0.36 : 0.33;
  const pegZ = s.style === 'sport' ? -0.12 : 0.04;
  k.node('foot_L', [0.17, pegY, pegZ]);
  k.node('foot_R', [-0.17, pegY, pegZ]);
  k.node('gear_mount', [0, seat + 0.04, -s.L / 2 + 0.12]);
  return k.build();
}

export const bikeCub = (): Group => bike('bike_cub', SHAPES.cub);
export const bikeScooter = (): Group => bike('bike_scooter', SHAPES.scooter);
export const bikeSport = (): Group => bike('bike_sport', SHAPES.sport);

export function gearTopbox(): Group {
  const k = new PlaceholderKit('gear_topbox').color('Gear_Paint', '#2a2d33');
  k.node('box');
  k.box('box', 'Gear_Paint', [0.4, 0.3, 0.38], [0, 0.15, 0], 0.07);
  k.box('box', 'Trim', [0.41, 0.04, 0.39], [0, 0.2, 0], 0.02);
  k.box('box', 'Light_Tail', [0.22, 0.04, 0.02], [0, 0.17, -0.195], 0.01);
  return k.build();
}

export function gearBag(): Group {
  const k = new PlaceholderKit('gear_bag');
  k.node('bag');
  k.box('bag', 'Gear_Paint', [0.44, 0.44, 0.42], [0, 0.22, 0], 0.06);
  k.quad('bag', 'Gear_Logo', 0.28, 0.2, [0, 0.24, -0.215], [0, Math.PI, 0]);
  k.box('bag', 'Trim', [0.46, 0.04, 0.44], [0, 0.05, 0], 0.02);
  return k.build();
}

/** pillion seat gear stand-ins (origin = top of the pillion seat, mounted on seat_pillion) */
export function gearCushion(): Group {
  const k = new PlaceholderKit('gear_cushion').color('Gear_Paint', '#ec4f9c');
  k.node('cushion');
  k.box('cushion', 'Gear_Paint', [0.38, 0.055, 0.32], [0, 0.028, 0], 0.025);
  return k.build();
}

export function gearBackrest(): Group {
  const k = new PlaceholderKit('gear_backrest').color('Gear_Paint', '#3ee6d4');
  k.node('backrest');
  k.box('backrest', 'Gear_Paint', [0.36, 0.035, 0.3], [0, 0.018, 0], 0.015);
  k.box('backrest', 'Gear_Paint', [0.32, 0.24, 0.06], [0, 0.31, -0.2], 0.03);
  return k.build();
}

export function gearThrone(): Group {
  const k = new PlaceholderKit('gear_throne').color('Gear_Paint', '#7a2a35');
  k.node('throne');
  k.box('throne', 'Gear_Paint', [0.42, 0.1, 0.36], [0, 0.05, 0], 0.03);
  k.box('throne', 'Gear_Paint', [0.37, 0.5, 0.06], [0, 0.37, -0.22], 0.03);
  return k.build();
}

export function gearRack(): Group {
  const k = new PlaceholderKit('gear_rack').color('Gear_Paint', '#3b3f46');
  k.node('rack');
  k.box('rack', 'Gear_Paint', [0.34, 0.03, 0.34], [0, 0.015, 0], 0.01);
  for (const [x, z] of [[0.17, 0.17], [-0.17, 0.17], [0.17, -0.17], [-0.17, -0.17]]) {
    k.box('rack', 'Gear_Paint', [0.02, 0.24, 0.02], [x, 0.13, z], 0.005);
  }
  k.box('rack', 'Gear_Paint', [0.36, 0.02, 0.02], [0, 0.25, 0.17], 0.005);
  k.box('rack', 'Gear_Paint', [0.36, 0.02, 0.02], [0, 0.25, -0.17], 0.005);
  return k.build();
}
