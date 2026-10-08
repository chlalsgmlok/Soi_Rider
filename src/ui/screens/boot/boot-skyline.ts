/**
 * Boot backdrop art: a dusk Bangkok skyline (shophouses + towers with lit windows) crossed by the BTS viaduct with a
 * train, and sagging overhead power cables from a street pole. Deterministic (seeded Rng), pure SVG, styled in boot.css.
 */
import { Rng } from '../../../core/rng';
import { s } from '../../core/h';

const W = 1600;
const H = 260;

function buildingLayer(rng: Rng, cls: string, minH: number, maxH: number, lit: number): SVGGElement {
  const g = s('g', { class: cls });
  let x = -20;
  while (x < W) {
    const w = rng.int(46, 128);
    const hgt = rng.range(minH, maxH);
    const top = H - hgt;
    g.append(s('rect', { x, y: top, width: w, height: hgt + 4, class: 'bk-mass' }));
    // shophouse parapet or tower crown
    if (rng.chance(0.35)) g.append(s('rect', { x: x + w * 0.3, y: top - 10, width: w * 0.4, height: 11, class: 'bk-mass' }));
    if (rng.chance(0.18)) g.append(s('rect', { x: x + w * 0.48, y: top - 34, width: 2.5, height: 26, class: 'bk-mass' }));
    for (let wy = top + 10; wy < H - 22; wy += 15) {
      for (let wx = x + 8; wx < x + w - 10; wx += 13) {
        if (rng.chance(lit)) g.append(s('rect', { x: wx, y: wy, width: 6, height: 7, rx: 1, class: rng.chance(0.25) ? 'bk-win bk-win--cool' : 'bk-win' }));
      }
    }
    x += w + rng.int(-6, 10);
  }
  return g;
}

function viaduct(): SVGGElement {
  const g = s('g', { class: 'bk-bts' });
  const deckY = H - 78;
  for (let x = 60; x < W; x += 210) g.append(s('path', { d: `M${x - 14} ${H}V${deckY + 18}h28V${H}z`, class: 'bk-pillar' }));
  g.append(s('rect', { x: -10, y: deckY, width: W + 20, height: 18, class: 'bk-deck' }));
  g.append(s('rect', { x: -10, y: deckY + 14, width: W + 20, height: 4, class: 'bk-deck-shade' }));
  const train = s('g.bk-train', null, s('rect', { x: 0, y: deckY - 30, width: 380, height: 30, rx: 9, class: 'bk-car' }));
  for (let i = 0; i < 3; i++) {
    const cx = i * 128;
    train.append(s('rect', { x: cx + 4, y: deckY - 24, width: 118, height: 9, rx: 3, class: 'bk-car-win' }));
    train.append(s('rect', { x: cx + 4, y: deckY - 11, width: 118, height: 3, class: 'bk-car-stripe' }));
  }
  g.append(train);
  return g;
}

/** bottom skyline with the BTS line in front of the back layer */
export function skylineSvg(): SVGSVGElement {
  const rng = new Rng(23).fork('boot-skyline');
  return s(
    'svg.boot-skyline',
    { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMax slice', 'aria-hidden': 'true' },
    buildingLayer(rng.fork('back'), 'bk-back', 70, 190, 0.12),
    viaduct(),
    buildingLayer(rng.fork('front'), 'bk-front', 22, 84, 0.2),
  );
}

/** overhead cables strung from a pole at the top-left — a Bangkok soi signature */
export function cablesSvg(): SVGSVGElement {
  const g = s('g', { class: 'bk-cables' });
  const runs: Array<[number, number, number]> = [
    [70, 40, 120], [82, 18, 150], [96, 64, 96], [110, 6, 170], [124, 88, 70],
  ];
  for (const [y0, y1, sag] of runs) g.append(s('path', { d: `M150 ${y0}Q820 ${y0 + sag} 1640 ${y1}` }));
  return s(
    'svg.boot-cables',
    { viewBox: '0 0 1600 260', preserveAspectRatio: 'xMinYMin slice', 'aria-hidden': 'true' },
    g,
    s('rect', { x: 132, y: -10, width: 16, height: 300, rx: 3, class: 'bk-pole' }),
    s('rect', { x: 112, y: 60, width: 58, height: 7, rx: 2, class: 'bk-pole' }),
    s('rect', { x: 116, y: 96, width: 50, height: 7, rx: 2, class: 'bk-pole' }),
  );
}
