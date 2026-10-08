import type { Group } from 'three';
import { PALETTE as P } from '../../../core/config/palette';
import { PlaceholderKit } from './kit';

/**
 * Buildings face +Z (street), origin = bottom-centre of the facade line, depth extends toward −Z.
 * Facade details are what the diorama camera sees, so they get the effort; the back is a plain block.
 */
function shophouse(name: string, floors: number): Group {
  const H = 1.5 + floors * 3;
  const k = new PlaceholderKit(name).color('Wall', P.wallCream).color('Wall2', P.wallSalmon);
  k.node('body');
  k.box('body', 'Wall', [3.96, H, 9.9], [0, H / 2, -5], 0.05);
  k.box('body', 'Wall2', [4.0, 0.35, 0.3], [0, H - 0.1, 0], 0.04);
  for (const x of [1.82, -1.82]) k.box('body', 'Wall2', [0.32, 3.0, 0.24], [x, 1.5, 0.02], 0.03);
  // ground floor: half-open roller shutter over a lit shop interior
  k.box('body', 'Interior_Light', [3.3, 1.7, 0.1], [0, 0.85, -0.25], 0.01);
  k.box('body', 'Shutter', [3.3, 1.15, 0.12], [0, 2.25, -0.08], 0.02);
  for (let i = 0; i < 6; i++) k.box('body', 'Trim', [3.32, 0.02, 0.13], [0, 1.75 + i * 0.18, -0.07], 0.005);
  // awning with alternating stripes and a scalloped front edge
  for (let i = 0; i < 8; i++) {
    const x = -1.75 + i * 0.5;
    k.box('body', i % 2 ? 'Awning_B' : 'Awning_A', [0.5, 0.05, 1.7], [x, 2.85, 0.85], 0.01, [-0.28, 0, 0]);
    k.ball('body', i % 2 ? 'Awning_B' : 'Awning_A', 0.12, [x, 2.6, 1.68], [2.05, 0.9, 0.35], 8);
  }
  k.node('signboard', [0, 3.42, 0.08]);
  k.quad('signboard', 'Sign_Face', 3.3, 0.68, [0, 3.42, 0.08]);
  for (let f = 1; f < floors; f++) {
    const y = 3 + (f - 1) * 3 + 1.55;
    for (const x of [-0.95, 0.95]) {
      k.box('body', 'Trim', [1.3, 1.5, 0.12], [x, y, 0.02], 0.03);
      k.box('body', 'Window', [1.1, 1.3, 0.1], [x, y, 0.05], 0.02);
    }
    k.box('body', 'Wall2', [3.7, 0.12, 0.7], [0, y - 0.85, 0.32], 0.03);
    k.box('body', 'Trim', [3.7, 0.5, 0.04], [0, y - 0.55, 0.66], 0.01);
    if (f === 1) k.box('body', 'Metal', [0.75, 0.5, 0.3], [1.3, y - 0.5, 0.35], 0.04);
  }
  return k.build();
}

export const bldShophouse2f = (): Group => shophouse('bld_shophouse_2f', 2);
export const bldShophouse3f = (): Group => shophouse('bld_shophouse_3f', 3);
export const bldShophouse4f = (): Group => shophouse('bld_shophouse_4f', 4);

export function bldMinimart(): Group {
  const k = new PlaceholderKit('bld_minimart').color('Wall', P.wallWhite).color('Paint', '#1f8a4c').color('Paint2', P.taxiOrange);
  k.node('body');
  k.box('body', 'Wall', [8, 4.5, 12], [0, 2.25, -6], 0.06);
  k.box('body', 'Interior_Light', [7, 2.6, 0.1], [0, 1.4, -0.12], 0.01);
  k.box('body', 'Glass', [7.2, 2.8, 0.08], [0, 1.45, 0.02], 0.02);
  k.box('body', 'Paint', [8.04, 0.35, 0.2], [0, 3.15, 0.02], 0.03);
  k.box('body', 'Paint2', [8.04, 0.2, 0.2], [0, 3.42, 0.02], 0.03);
  k.node('signboard', [0, 3.95, 0.06]);
  k.quad('signboard', 'Sign_Face', 5, 0.7, [0, 3.95, 0.06]);
  return k.build();
}

export function bldMall(): Group {
  const k = new PlaceholderKit('bld_mall').color('Wall', P.wallPowder).color('Wall2', P.wallWhite);
  k.node('body');
  k.box('body', 'Wall', [32, 18, 30], [0, 9, -15], 0.2);
  k.box('body', 'Glass', [28, 4, 0.2], [0, 2.5, 0.05], 0.05);
  k.box('body', 'Glass', [30, 2.2, 0.2], [0, 9.5, 0.05], 0.05);
  k.box('body', 'Trim', [14, 0.3, 3.5], [0, 4.7, 1.7], 0.05);
  k.box('body', 'Wall2', [32.2, 1.2, 0.5], [0, 17.5, 0], 0.1);
  k.node('screen', [6, 12.5, 0.18]);
  k.quad('screen', 'Sign_Face', 10, 5.5, [6, 12.5, 0.18]);
  return k.build();
}

function tower(name: string, w: number, h: number, glass: boolean): Group {
  const k = new PlaceholderKit(name).color('Wall', glass ? '#7fa6c4' : P.wallWhite).color('Wall2', P.wallPowder);
  k.node('body');
  k.box('body', glass ? 'Glass' : 'Wall', [w, h, w], [0, h / 2, -w / 2], 0.2);
  for (let y = 4; y < h - 2; y += glass ? 4 : 3) {
    k.box('body', glass ? 'Trim' : 'Window', [w + 0.06, glass ? 0.25 : 1.2, w + 0.06], [0, y, -w / 2], 0.02);
  }
  k.box('body', 'Wall2', [w * 0.6, glass ? 6 : 2.5, w * 0.6], [0, h + (glass ? 3 : 1.25), -w / 2], 0.1);
  if (!glass) k.cyl('body', 'Metal', 1.4, 1.4, 2.6, [w * 0.2, h + 3.8, -w * 0.4], 'y', 12);
  return k.build();
}

export const bldCondo = (): Group => tower('bld_condo', 16, 60, false);
export const bldOffice = (): Group => tower('bld_office', 20, 80, true);

export function bldTemple(): Group {
  const k = new PlaceholderKit('bld_temple').color('Wall', '#f7f2e6').color('Wall2', '#e8dcc4');
  k.node('body');
  k.box('body', 'Wall2', [18, 1.0, 30], [0, 0.5, -15], 0.1);
  k.box('body', 'Wall2', [8, 0.6, 2.5], [0, 0.3, 1.0], 0.05);
  k.box('body', 'Wall', [12, 6, 25], [0, 4, -15], 0.1);
  for (const [i, y] of [[0, 8.0], [1, 10.4]] as const) {
    const sx = 7.6 - i * 2.2;
    for (const s of [1, -1]) {
      k.box('body', i ? 'Roof2' : 'Roof', [sx, 0.35, 27 - i * 5], [s * sx * 0.4, y, -15], 0.08, [0, 0, s * 0.62]);
    }
  }
  k.box('body', 'Gold', [0.25, 2.4, 0.25], [0, 12.6, -1.6], 0.05);
  k.box('body', 'Gold', [0.25, 2.4, 0.25], [0, 12.6, -28.4], 0.05);
  k.box('body', 'Gold', [0.4, 0.4, 25], [0, 12.0, -15], 0.08);
  k.box('body', 'Trim', [2.4, 3.6, 0.2], [0, 2.8, -2.45], 0.05);
  return k.build();
}

export function btsPillar(): Group {
  const k = new PlaceholderKit('bts_pillar');
  k.node('body');
  k.cyl('body', 'Concrete', 0.85, 1.0, 9.0, [0, 4.5, 0], 'y', 16);
  k.box('body', 'Concrete', [10.5, 1.3, 2.4], [0, 8.85, 0], 0.2);
  return k.build();
}

export function btsDeck(): Group {
  const k = new PlaceholderKit('bts_deck');
  k.node('body');
  k.box('body', 'Concrete', [9, 1.1, 40], [0, 10.05, 0], 0.25);
  k.box('body', 'Concrete', [0.3, 0.9, 40], [4.35, 11.0, 0], 0.05);
  k.box('body', 'Concrete', [0.3, 0.9, 40], [-4.35, 11.0, 0], 0.05);
  k.box('body', 'Metal', [0.1, 0.12, 40], [2.0, 10.66, 0], 0.02);
  k.box('body', 'Metal', [0.1, 0.12, 40], [-2.0, 10.66, 0], 0.02);
  return k.build();
}

export function btsStation(): Group {
  const k = new PlaceholderKit('bts_station').color('Wall', '#e9eef2');
  k.node('body');
  k.box('body', 'Wall', [18, 6.5, 60], [0, 11.25, 0], 0.3);
  k.box('body', 'Glass', [18.1, 2.0, 56], [0, 12.6, 0], 0.1);
  k.box('body', 'Metal', [19, 0.8, 61], [0, 16.6, 0], 0.3);
  k.node('signboard', [0, 15.0, 30.06]);
  k.quad('signboard', 'Sign_Face', 8, 1.2, [0, 15.0, 30.06]);
  return k.build();
}
