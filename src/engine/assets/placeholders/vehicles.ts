import type { Group } from 'three';
import { PALETTE as P } from '../../../core/config/palette';
import { PlaceholderKit } from './kit';

interface CarShape {
  L: number;
  W: number;
  H: number;
  wheelR: number;
  wheelbase: number;
  /** body (hood/beltline) height */
  belt: number;
  /** cabin z range (model space, +Z = front) */
  cabin: [number, number];
  mirrorZ: number;
  mirrorY: number;
  mirrorSpan: number;
  paint: string;
  paint2: string;
}

/** shared chassis: body, glass cabin, lights, plates, 4 wheels, folding mirrors */
function chassis(k: PlaceholderKit, s: CarShape, threeWheels = false): PlaceholderKit {
  const { L, W, H, wheelR: r, wheelbase: wb, belt } = s;
  k.color('Paint', s.paint).color('Paint2', s.paint2);
  k.node('body');
  const floor = r * 0.75;
  k.box('body', 'Paint', [W, belt - floor, L], [0, (belt + floor) / 2, 0], 0.12);
  const [c0, c1] = s.cabin;
  const cl = c1 - c0;
  const cz = (c0 + c1) / 2;
  k.box('body', 'Glass', [W * 0.9, (H - belt) * 0.82, cl * 0.96], [0, belt + (H - belt) * 0.42, cz], 0.08);
  k.box('body', 'Paint2', [W * 0.88, 0.08, cl * 0.92], [0, H - 0.04, cz], 0.04);
  for (const sx of [1, -1]) {
    k.box('body', 'Paint2', [0.06, H - belt, 0.12], [sx * W * 0.44, (H + belt) / 2, c1 - 0.06], 0.02);
    k.box('body', 'Paint2', [0.06, H - belt, 0.14], [sx * W * 0.44, (H + belt) / 2, c0 + 0.07], 0.02);
  }
  k.box('body', 'Trim', [W * 1.01, 0.2, 0.18], [0, floor + 0.12, L / 2 - 0.06], 0.06);
  k.box('body', 'Trim', [W * 1.01, 0.2, 0.18], [0, floor + 0.12, -L / 2 + 0.06], 0.06);
  k.quad('body', 'Plate', 0.36, 0.12, [0, floor + 0.26, L / 2 + 0.005]);
  k.quad('body', 'Plate', 0.36, 0.12, [0, floor + 0.26, -L / 2 - 0.005], [0, Math.PI, 0]);
  k.box('body', 'Light_Tail', [W * 0.16, 0.12, 0.05], [W * 0.38, belt - 0.16, -L / 2 + 0.01], 0.02);
  k.box('body', 'Light_Tail', [W * 0.16, 0.12, 0.05], [-W * 0.38, belt - 0.16, -L / 2 + 0.01], 0.02);

  k.node('head_lights');
  k.box('head_lights', 'Light_Head', [W * 0.2, 0.12, 0.05], [W * 0.33, belt - 0.14, L / 2 + 0.005], 0.03);
  k.box('head_lights', 'Light_Head', [W * 0.2, 0.12, 0.05], [-W * 0.33, belt - 0.14, L / 2 + 0.005], 0.03);
  k.node('brake_lights');
  k.box('brake_lights', 'Light_Brake', [W * 0.14, 0.1, 0.04], [W * 0.38, belt - 0.03, -L / 2 + 0.005], 0.02);
  k.box('brake_lights', 'Light_Brake', [W * 0.14, 0.1, 0.04], [-W * 0.38, belt - 0.03, -L / 2 + 0.005], 0.02);

  const track = W / 2 - 0.12;
  const wheels: Array<[string, number, number]> = threeWheels
    ? [['wheel_F', 0, wb / 2], ['wheel_RL', track, -wb / 2], ['wheel_RR', -track, -wb / 2]]
    : [['wheel_FL', track, wb / 2], ['wheel_FR', -track, wb / 2], ['wheel_RL', track, -wb / 2], ['wheel_RR', -track, -wb / 2]];
  for (const [name, x, z] of wheels) {
    k.node(name, [x, r, z]);
    k.cyl(name, 'Tire', r, r, 0.22, [x, r, z], 'x', 14);
    k.cyl(name, 'Chrome', r * 0.5, r * 0.5, 0.23, [x, r, z], 'x', 10);
  }

  for (const [name, sx] of [['mirror_L', 1], ['mirror_R', -1]] as const) {
    const hx = sx * W * 0.47;
    k.node(name, [hx, s.mirrorY, s.mirrorZ]);
    const reach = s.mirrorSpan / 2 - W * 0.47;
    k.box(name, 'Trim', [reach, 0.04, 0.05], [hx + (sx * reach) / 2, s.mirrorY, s.mirrorZ], 0.015);
    k.box(name, 'Paint2', [0.07, 0.13, 0.2], [sx * (s.mirrorSpan / 2 - 0.03), s.mirrorY + 0.03, s.mirrorZ], 0.03);
  }
  return k;
}

function car(name: string, s: CarShape, extra?: (k: PlaceholderKit) => void): Group {
  const k = chassis(new PlaceholderKit(name), s);
  extra?.(k);
  return k.build();
}

export function vehicleTaxi(): Group {
  return car('veh_taxi', {
    L: 4.6, W: 1.76, H: 1.5, wheelR: 0.32, wheelbase: 2.65, belt: 0.92, cabin: [-1.2, 0.85],
    mirrorZ: 0.75, mirrorY: 1.0, mirrorSpan: 2.0, paint: P.taxiPink, paint2: P.taxiPink,
  }, (k) => {
    k.node('taxi_sign', [0, 1.5, -0.15]);
    k.box('taxi_sign', 'Sign_Taxi', [0.62, 0.18, 0.26], [0, 1.6, -0.15], 0.05);
  });
}

export function vehicleSedan(): Group {
  return car('veh_sedan', {
    L: 4.5, W: 1.75, H: 1.45, wheelR: 0.32, wheelbase: 2.65, belt: 0.9, cabin: [-1.15, 0.8],
    mirrorZ: 0.7, mirrorY: 1.0, mirrorSpan: 1.98, paint: P.carSilver, paint2: P.carSilver,
  });
}

export function vehicleVan(): Group {
  return car('veh_van', {
    L: 5.4, W: 1.9, H: 2.25, wheelR: 0.33, wheelbase: 3.1, belt: 1.12, cabin: [-2.55, 1.75],
    mirrorZ: 1.75, mirrorY: 1.45, mirrorSpan: 2.18, paint: P.vanWhite, paint2: P.vanWhite,
  }, (k) => {
    k.box('body', 'Trim', [0.02, 0.05, 2.2], [0.95, 1.05, -0.4], 0.01);
  });
}

export function vehiclePickup(): Group {
  return car('veh_pickup', {
    L: 5.3, W: 1.85, H: 1.8, wheelR: 0.38, wheelbase: 3.1, belt: 1.1, cabin: [-0.5, 1.15],
    mirrorZ: 1.0, mirrorY: 1.2, mirrorSpan: 2.1, paint: P.carWhite, paint2: P.carWhite,
  }, (k) => {
    k.box('body', 'Trim', [1.7, 0.08, 2.0], [0, 1.08, -1.6], 0.02);
  });
}

export function vehicleSongthaew(): Group {
  return car('veh_songthaew', {
    L: 5.0, W: 1.8, H: 2.2, wheelR: 0.36, wheelbase: 2.9, belt: 1.05, cabin: [0.3, 1.3],
    mirrorZ: 1.3, mirrorY: 1.2, mirrorSpan: 2.05, paint: P.busRed, paint2: P.busRed,
  }, (k) => {
    k.box('body', 'Paint', [1.8, 0.1, 2.6], [0, 2.18, -1.1], 0.05);
    for (const x of [0.86, -0.86]) for (const z of [0.15, -2.35]) k.box('body', 'Chrome', [0.05, 1.1, 0.05], [x, 1.62, z], 0.01);
    k.box('body', 'Seat', [0.35, 0.12, 2.3], [0.62, 1.32, -1.1], 0.03);
    k.box('body', 'Seat', [0.35, 0.12, 2.3], [-0.62, 1.32, -1.1], 0.03);
  });
}

export function vehicleBus(): Group {
  return car('veh_bus', {
    L: 11.5, W: 2.5, H: 3.2, wheelR: 0.5, wheelbase: 6.4, belt: 1.35, cabin: [-5.6, 5.6],
    mirrorZ: 5.4, mirrorY: 2.1, mirrorSpan: 2.9, paint: P.busRed, paint2: P.busCream,
  }, (k) => {
    k.node('route_board', [0, 2.85, 5.76]);
    k.quad('route_board', 'Sign_Face', 1.7, 0.32, [0, 2.85, 5.76]);
  });
}

export function vehicleTuktuk(): Group {
  const k = chassis(new PlaceholderKit('veh_tuktuk'), {
    L: 3.0, W: 1.4, H: 1.9, wheelR: 0.24, wheelbase: 1.95, belt: 0.75, cabin: [-1.3, 0.6],
    mirrorZ: 1.1, mirrorY: 1.3, mirrorSpan: 1.6, paint: P.tuktukBlue, paint2: P.taxiYellow,
  }, true);
  k.box('body', 'Canopy', [1.46, 0.12, 2.3], [0, 1.88, -0.3], 0.06);
  k.box('body', 'Paint2', [1.48, 0.08, 2.32], [0, 1.8, -0.3], 0.03);
  for (const x of [0.66, -0.66]) for (const z of [0.75, -1.35]) k.box('body', 'Chrome', [0.04, 1.05, 0.04], [x, 1.3, z], 0.01);
  k.box('body', 'Seat', [1.25, 0.3, 0.55], [0, 0.95, -0.95], 0.08);
  return k.build();
}

export function btsTrain(): Group {
  const k = new PlaceholderKit('bts_train').color('Paint', '#f2f2f0').color('Paint2', '#2a8f5a');
  k.node('body');
  k.box('body', 'Paint', [3.0, 3.4, 22], [0, 2.0, 0], 0.35);
  k.box('body', 'Glass', [3.04, 1.0, 20.5], [0, 2.4, 0], 0.08);
  k.box('body', 'Paint2', [3.06, 0.25, 21.6], [0, 1.4, 0], 0.05);
  k.box('body', 'Trim', [2.6, 0.4, 21], [0, 0.2, 0], 0.05);
  return k.build();
}
