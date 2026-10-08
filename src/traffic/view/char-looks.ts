import { Color } from 'three';
import { PALETTE as P } from '../../core/config/palette';
import { lookUnit } from '../peds/ped-looks';
import type { Pedestrian } from '../peds/pedestrian';
import type { CharacterLook, HeadGear, TorsoGear } from './character-rig';

const cache = new Map<string, Color>();
/** shared Color per hex (sRGB → linear once) */
export function colorOf(hex: string): Color {
  let c = cache.get(hex);
  if (!c) {
    c = new Color(hex);
    cache.set(hex, c);
  }
  return c;
}

const SKINS = [P.skin1, P.skin2, P.skin2, P.skin3, P.skin3, P.skin4];
const SHIRTS = ['#E85D5D', '#3F7FD0', '#F2C230', '#3E9D5A', '#F4F0E8', '#2A2C31', '#F28C9B', '#7A5BC7', '#FF8A2A', '#9FD3C7',
  '#C9D6E8', '#2B3A5C', '#F4E27A', '#E24B3B'];
const PANTS = ['#2B3A5C', '#2A2C31', '#4A5A78', '#B9A47E', '#6E6762', '#3A4A3A', '#E8E2D6', '#1F2A44'];
const HAIRS = [P.hairBlack, P.hairBlack, P.hairBlack, P.hairBlack, P.hairBrown, P.hairBrown, '#8A6A4A', '#C9A15A'];
const HELMETS = ['#F2F2F0', '#2A2C31', '#E23C3C', '#2F6FD6', '#F7C928', '#F2559A', '#34B04A', '#FF8A2A', '#C9CDD3'];
const JACKETS = ['#2A2C31', '#2B3A5C', '#7A2A35', '#3E9D5A', '#C9CDD3', '#5A3A28'];
const PONCHOS = ['#F7C928', '#2F6FD6', '#E23C3C', '#34B04A', '#F2559A', '#3EE6D4'];
const UMBRELLAS = ['#E24B3B', '#2F6FD6', '#2A2C31', '#F2559A', '#F7C928', '#3E9D5A', '#7A5BC7'];
const SAFFRON = '#E8892B';
const WIN_VEST = '#FF8A2A';
const HAIR_GEAR: readonly HeadGear[] = ['hair_short', 'hair_short', 'hair_short', 'hair_long', 'hair_long', 'hair_bun', 'hat_cap'];
const HELMET_GEAR: readonly HeadGear[] = ['helmet_open', 'helmet_open', 'helmet_half', 'helmet_full', 'helmet_full', 'helmet_cat'];

const pick = <T>(list: readonly T[], look: number, channel: number): T => list[Math.floor(lookUnit(look, channel) * list.length)];

export function createLook(): CharacterLook {
  const w = colorOf('#ffffff');
  return { skin: w, shirt: w, pants: w, hair: w, head: null, headColor: w, torso: null, torsoColor: w, umbrella: false, umbrellaColor: w };
}

function base(look: number, out: CharacterLook): void {
  out.skin = colorOf(pick(SKINS, look, 1));
  out.shirt = colorOf(pick(SHIRTS, look, 2));
  out.pants = colorOf(pick(PANTS, look, 3));
  out.hair = colorOf(pick(HAIRS, look, 4));
  out.head = null;
  out.torso = null;
  out.umbrella = false;
}

/** people on foot: walkers (hair / cap, umbrella in the rain), vendors (apron-ish shirts), monks (saffron, shaved) */
export function pedLook(p: Pedestrian, out: CharacterLook): CharacterLook {
  base(p.look, out);
  if (p.role === 'monk') {
    out.shirt = out.pants = colorOf(SAFFRON);
    out.hair = out.skin;
    return out;
  }
  out.head = lookUnit(p.look, 5) < 0.12 ? null : pick(HAIR_GEAR, p.look, 6);
  out.headColor = out.head === 'hat_cap' ? colorOf(pick(HELMETS, p.look, 7)) : out.hair;
  out.umbrella = p.umbrella;
  out.umbrellaColor = colorOf(pick(UMBRELLAS, p.look, 8));
  return out;
}

/** motorbike riders: always a helmet; win-taxi vests, jackets, hoods; ponchos in the rain */
export function riderLook(look: number, rain: number, out: CharacterLook): CharacterLook {
  base(look, out);
  out.head = pick(HELMET_GEAR, look, 9);
  out.headColor = colorOf(pick(HELMETS, look, 10));
  const u = lookUnit(look, 11);
  let torso: TorsoGear | null = u < 0.22 ? 'outfit_vest' : u < 0.5 ? 'outfit_jacket' : u < 0.6 ? 'outfit_hood' : null;
  if (rain > 0.25 && lookUnit(look, 12) < 0.65) torso = 'outfit_poncho';
  out.torso = torso;
  out.torsoColor = colorOf(torso === 'outfit_vest' ? WIN_VEST : torso === 'outfit_poncho' ? pick(PONCHOS, look, 13) : pick(JACKETS, look, 14));
  return out;
}

/** pillion passenger: no helmet half the time (Bangkok…), hair instead */
export function pillionLook(look: number, out: CharacterLook): CharacterLook {
  base(look ^ 0x2c1b3c6d, out);
  const helmet = lookUnit(look, 15) < 0.5;
  out.head = helmet ? pick(HELMET_GEAR, look, 16) : pick(HAIR_GEAR, look, 17);
  out.headColor = helmet ? colorOf(pick(HELMETS, look, 18)) : out.hair;
  return out;
}

/** drivers behind glass: hair, the occasional cap */
export function driverLook(look: number, out: CharacterLook): CharacterLook {
  base(look ^ 0x5bd1e995, out);
  out.head = pick(HAIR_GEAR, look, 19);
  out.headColor = out.head === 'hat_cap' ? colorOf(pick(HELMETS, look, 20)) : out.hair;
  return out;
}
