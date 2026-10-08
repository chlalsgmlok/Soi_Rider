import type { Group } from 'three';
import { PlaceholderKit } from './kit';

/**
 * char_body stand-in: segmented rig, joint pivots per ASSET_SPEC (hips z≈0.92, neck base, shoulders, elbows,
 * wrists, hips, knees, ankles), A-pose arms. Standing height 1.68 m, chunky toy proportions.
 */
export function charBody(): Group {
  const k = new PlaceholderKit('char_body');
  k.node('hips', [0, 0.92, 0]);
  k.box('hips', 'Pants', [0.32, 0.18, 0.21], [0, 0.93, 0], 0.07);
  k.node('torso', [0, 1.0, 0], 'hips');
  k.box('torso', 'Shirt', [0.36, 0.42, 0.22], [0, 1.2, 0], 0.09);
  k.node('head', [0, 1.4, 0], 'torso');
  k.cyl('head', 'Skin', 0.05, 0.055, 0.08, [0, 1.43, 0], 'y', 10);
  k.ball('head', 'Skin', 0.15, [0, 1.57, 0.005], [1, 1.07, 1], 16);
  k.ball('head', 'Trim', 0.018, [0.052, 1.585, 0.14], [0.8, 1.3, 0.5], 6);
  k.ball('head', 'Trim', 0.018, [-0.052, 1.585, 0.14], [0.8, 1.3, 0.5], 6);
  k.ball('head', 'Skin', 0.03, [0, 1.55, 0.155], [1, 0.8, 0.8], 6);

  for (const [side, sx] of [['L', 1], ['R', -1]] as const) {
    const sh = sx * 0.2;
    const el = sx * 0.245;
    const wr = sx * 0.285;
    k.node(`arm_${side}`, [sh, 1.34, 0], 'torso');
    k.ball(`arm_${side}`, 'Shirt', 0.07, [sh, 1.33, 0], [1, 1, 1], 10);
    k.cyl(`arm_${side}`, 'Shirt', 0.05, 0.045, 0.26, [(sh + el) / 2, 1.21, 0], 'y', 10);
    k.node(`forearm_${side}`, [el, 1.08, 0], `arm_${side}`);
    k.cyl(`forearm_${side}`, 'Shirt', 0.043, 0.038, 0.24, [(el + wr) / 2, 0.96, 0], 'y', 10);
    k.node(`hand_${side}`, [wr, 0.84, 0], `forearm_${side}`);
    k.ball(`hand_${side}`, 'Hands', 0.048, [wr + sx * 0.005, 0.8, 0.005], [0.9, 1.15, 0.8], 10);

    const hx = sx * 0.095;
    k.node(`thigh_${side}`, [hx, 0.9, 0], 'hips');
    k.cyl(`thigh_${side}`, 'Pants', 0.08, 0.068, 0.42, [hx, 0.7, 0], 'y', 10);
    k.node(`shin_${side}`, [hx, 0.5, 0], `thigh_${side}`);
    k.cyl(`shin_${side}`, 'Pants', 0.064, 0.055, 0.42, [hx, 0.29, 0], 'y', 10);
    k.node(`foot_${side}`, [hx, 0.08, 0], `shin_${side}`);
    k.box(`foot_${side}`, 'Shoes', [0.11, 0.085, 0.24], [hx, 0.045, 0.045], 0.035);
  }
  return k.build();
}

/** head attachments — origin = head pivot (neck base); head centre sits at +0.17 */
export function hairShort(): Group {
  const k = new PlaceholderKit('hair_short');
  k.ball('', 'Hair', 0.158, [0, 0.2, -0.012], [1.02, 0.86, 1.04], 14);
  return k.build();
}

export function hairLong(): Group {
  const k = new PlaceholderKit('hair_long');
  k.ball('', 'Hair', 0.16, [0, 0.2, -0.012], [1.03, 0.9, 1.05], 14);
  k.box('', 'Hair', [0.28, 0.3, 0.1], [0, 0.07, -0.1], 0.05);
  return k.build();
}

export function hairBun(): Group {
  const k = new PlaceholderKit('hair_bun');
  k.ball('', 'Hair', 0.158, [0, 0.2, -0.012], [1.02, 0.86, 1.04], 14);
  k.ball('', 'Hair', 0.065, [0, 0.32, -0.11], [1, 1, 1], 10);
  return k.build();
}

export function hatCap(): Group {
  const k = new PlaceholderKit('hat_cap');
  k.ball('', 'Hat', 0.162, [0, 0.22, 0], [1.02, 0.66, 1.04], 14);
  k.box('', 'Hat', [0.21, 0.02, 0.15], [0, 0.22, 0.19], 0.008);
  return k.build();
}

export function accMask(): Group {
  const k = new PlaceholderKit('acc_mask');
  k.box('', 'Mask', [0.17, 0.1, 0.06], [0, 0.12, 0.135], 0.03);
  return k.build();
}

export function helmetOpen(): Group {
  const k = new PlaceholderKit('helmet_open');
  k.ball('', 'Helmet_Paint', 0.192, [0, 0.2, -0.01], [1, 0.96, 1.06], 16);
  k.box('', 'Helmet_Trim', [0.24, 0.025, 0.1], [0, 0.29, 0.19], 0.01);
  k.box('', 'Helmet_Trim', [0.35, 0.03, 0.34], [0, 0.11, -0.02], 0.012);
  return k.build();
}

export function helmetFull(): Group {
  const k = new PlaceholderKit('helmet_full');
  k.ball('', 'Helmet_Paint', 0.205, [0, 0.18, 0], [1, 1, 1.05], 16);
  k.box('', 'Visor', [0.24, 0.11, 0.06], [0, 0.19, 0.18], 0.04);
  k.box('', 'Helmet_Trim', [0.2, 0.06, 0.08], [0, 0.07, 0.17], 0.03);
  return k.build();
}

export function helmetHalf(): Group {
  const k = new PlaceholderKit('helmet_half');
  k.ball('', 'Helmet_Paint', 0.185, [0, 0.23, -0.005], [1, 0.72, 1.05], 16);
  k.box('', 'Visor', [0.22, 0.055, 0.05], [0, 0.25, 0.16], 0.02);
  k.box('', 'Helmet_Trim', [0.34, 0.03, 0.3], [0, 0.22, 0], 0.012);
  return k.build();
}

export function helmetCat(): Group {
  const k = new PlaceholderKit('helmet_cat');
  k.ball('', 'Helmet_Paint', 0.198, [0, 0.19, 0], [1, 0.98, 1.04], 16);
  k.cyl('', 'Helmet_Paint', 0.006, 0.055, 0.1, [0.1, 0.37, 0], 'y', 8);
  k.cyl('', 'Helmet_Paint', 0.006, 0.055, 0.1, [-0.1, 0.37, 0], 'y', 8);
  k.box('', 'Visor', [0.22, 0.09, 0.05], [0, 0.18, 0.18], 0.03);
  k.box('', 'Helmet_Trim', [0.3, 0.03, 0.3], [0, 0.07, -0.02], 0.012);
  return k.build();
}

/** torso attachments — origin = torso pivot (waist) */
export function outfitVest(): Group {
  const k = new PlaceholderKit('outfit_vest');
  k.box('', 'Outfit_Paint', [0.385, 0.4, 0.24], [0, 0.21, 0], 0.08);
  k.box('', 'Outfit_Trim', [0.39, 0.035, 0.245], [0, 0.12, 0], 0.012);
  k.box('', 'Outfit_Trim', [0.39, 0.035, 0.245], [0, 0.28, 0], 0.012);
  k.quad('', 'Outfit_Trim', 0.16, 0.12, [0, 0.21, -0.125], [0, Math.PI, 0]);
  return k.build();
}

export function outfitHood(): Group {
  const k = new PlaceholderKit('outfit_hood');
  k.box('', 'Outfit_Paint', [0.39, 0.44, 0.245], [0, 0.2, 0], 0.09);
  k.ball('', 'Outfit_Paint', 0.13, [0, 0.42, -0.1], [1.1, 0.7, 0.8], 10);
  k.box('', 'Outfit_Paint', [0.01, 0.12, 0.01], [0.04, 0.32, 0.125], 0.003);
  k.box('', 'Outfit_Paint', [0.01, 0.12, 0.01], [-0.04, 0.32, 0.125], 0.003);
  return k.build();
}

export function outfitJacket(): Group {
  const k = new PlaceholderKit('outfit_jacket');
  k.box('', 'Outfit_Paint', [0.39, 0.43, 0.245], [0, 0.2, 0], 0.09);
  k.box('', 'Outfit_Trim', [0.26, 0.06, 0.2], [0, 0.42, 0], 0.03);
  k.box('', 'Outfit_Trim', [0.02, 0.38, 0.01], [0, 0.2, 0.124], 0.004);
  return k.build();
}

export function outfitPoncho(): Group {
  const k = new PlaceholderKit('outfit_poncho');
  k.cyl('', 'Poncho', 0.21, 0.4, 0.78, [0, 0.04, 0], 'y', 16);
  k.ball('', 'Poncho', 0.15, [0, 0.47, -0.08], [1.1, 0.8, 0.9], 12);
  return k.build();
}
