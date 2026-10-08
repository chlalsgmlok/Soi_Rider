import { dist, localToWorld } from '../../../core/math2d';
import type { CityData, CityQuery, Placement, StaticCollider, Vec2 } from '../../../core/types';

/** what the intro frames at the start of a run */
export interface StandSite {
  /** the rider's spawn (curb lane beside the stand, facing the soi mouth) */
  spawn: CityData['spawn'];
  /** the home win stand (meta.home) and Lek's khao man gai cart (meta.story = 'lek'), when the generator placed them */
  stand: Placement | null;
  cart: Placement | null;
  /** where Aunt Lek stands by her cart (the side the traffic vendor does not take first), facing the street */
  lek: { pos: Vec2; heading: number } | null;
  /** ground centre of rider + stand + cart (what the stand shot frames) */
  focus: Vec2;
}

/** cart-local [right, forward] offsets of a vendor beside the cart; src/traffic staffs carts trying +1.9 first */
const LEK_SIDES = [-1.75, 1.9] as const;
const near: StaticCollider[] = [];

function nearest(list: Placement[], p: Vec2, max: number): Placement | null {
  let best: Placement | null = null;
  let d = max;
  for (const q of list) {
    const dd = dist(q.pos, p);
    if (dd < d) [best, d] = [q, dd];
  }
  return best;
}

/** where Lek can stand: beside the cart, on a side free of static clutter */
function lekSpot(q: CityQuery, cart: Placement): { pos: Vec2; heading: number } {
  for (const side of LEK_SIDES) {
    const pos = localToWorld(cart.pos, cart.heading, side, -0.45);
    q.staticNear(pos, 0.35, near);
    if (near.every((o) => o.id === cart.collider)) return { pos, heading: cart.heading + (side > 0 ? 0.6 : -0.6) };
  }
  return { pos: localToWorld(cart.pos, cart.heading, LEK_SIDES[0], -0.45), heading: cart.heading - 0.6 };
}

/** the run's win stand scene: spawn, home stand, Lek's cart and her spot (all optional but the spawn) */
export function findStandSite(q: CityQuery, spawn: CityData['spawn'] = q.data.spawn): StandSite {
  const all = q.data.placements;
  const stand = nearest(all.filter((p) => p.asset === 'prop_win_stand' && p.meta?.home === '1'), spawn.pos, 25)
    ?? nearest(all.filter((p) => p.asset === 'prop_win_stand'), spawn.pos, 12);
  const cart = nearest(all.filter((p) => p.asset === 'prop_food_cart' && p.meta?.story === 'lek'), spawn.pos, 25);
  const pts = [spawn.pos, ...(stand ? [stand.pos] : []), ...(cart ? [cart.pos] : [])];
  const focus = {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
  };
  return { spawn, stand, cart, lek: cart ? lekSpot(q, cart) : null, focus };
}
