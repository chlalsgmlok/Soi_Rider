import type { Material, Mesh, Object3D, Texture } from 'three';
import { colorHex } from '../../core/config/catalog';
import { PALETTE } from '../../core/config/palette';
import type { GearId, Loadout, OutfitId } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import { isMesh, isStandardMaterial } from '../../engine/assets/material-guards';
import { findMaterials, findNode, matchesMaterial, setColor } from '../../engine/assets/material-tools';
import { fitSleeves, isUpperSleeve } from '../../engine/assets/outfit-sleeves';
import { alohaTexture, cylinderUv } from './aloha';
import { mergeParts, releasePart } from './merge-parts';

/** overlay GLB per outfit (tee and aloha are the body's own Shirt) */
export const OUTFIT_ASSET: Readonly<Record<OutfitId, string | null>> = {
  tee: null, win_vest: 'outfit_vest', hoodie: 'outfit_hood', track_jacket: 'outfit_jacket', aloha: null,
};

/** rider look constants: skin, denim, black riding gloves (mockup 02) */
export const RIDER_LOOK = { skin: PALETTE.skin2, pants: '#3a4f78', gloves: '#25272d', under: '#f2efe8' } as const;

/** everything the outfit swap created (so the next swap can release it) */
export interface Dressing {
  helmet: Object3D | null;
  helmetId: string;
  outfit: Object3D | null;
  /** the outfit's sleeve shells, moved onto arm_* / forearm_* (released with the outfit) */
  sleeves: Object3D[];
  outfitKey: string;
  gear: Object3D | null;
  gearId: string;
  aloha: Texture | null;
  /** shirt meshes whose geometry was cloned for UVs: [mesh, original geometry] */
  uvMeshes: Array<[Mesh, Mesh['geometry']]>;
}

export const emptyDressing = (): Dressing => ({
  helmet: null, helmetId: '', outfit: null, sleeves: [], outfitKey: '', gear: null, gearId: '', aloha: null,
  uvMeshes: [],
});

function attach(assets: Assets, parent: Object3D | null, asset: string): Object3D | null {
  if (!parent) return null;
  const o = assets.instance(asset);
  parent.add(o);
  return o;
}

/** how high pillion seat gear lifts the passenger above the bike's seat_pillion (m) */
const SEAT_LIFT: Partial<Record<GearId, number>> = { gear_cushion: 0.05, gear_backrest: 0.03, gear_throne: 0.095 };

/** seat gear (cushion / backrest / throne) sits on the pillion seat, the rest on the rear rack */
export const gearMountOf = (gear: GearId): string => (gear in SEAT_LIFT ? 'seat_pillion' : 'gear_mount');

/** passenger lift for the equipped gear (0 for rack gear) */
export const seatLift = (gear: GearId): number => SEAT_LIFT[gear] ?? 0;

/** paint the bike (Paint = chosen colour; Paint2 keeps its authored cream/white accent) */
export function paintBike(bike: Object3D, l: Loadout): void {
  setColor(bike, 'Paint', colorHex(l.bikeColor));
}

/** helmet, outfit overlay / shirt, gloves and gear for the rider; idempotent, releases what it replaces */
export function dressRider(assets: Assets, body: Object3D, bike: Object3D, l: Loadout, d: Dressing): void {
  setColor(body, 'Skin', RIDER_LOOK.skin);
  setColor(body, 'Hands', RIDER_LOOK.gloves);
  setColor(body, 'Pants', RIDER_LOOK.pants);

  if (d.helmetId !== l.helmet) {
    if (d.helmet) releasePart(assets, d.helmet);
    d.helmet = attach(assets, findNode(body, 'head'), l.helmet);
    d.helmetId = l.helmet;
  }
  if (d.helmet) setColor(d.helmet, 'Helmet_Paint', colorHex(l.helmetColor));

  const outfitColor = colorHex(l.outfitColor);
  const overlay = OUTFIT_ASSET[l.outfit];
  if (d.outfitKey !== l.outfit) {
    releaseOutfit(assets, d);
    d.outfit = overlay ? attach(assets, findNode(body, 'torso'), overlay) : null;
    // hoodie / track jacket sleeves bend with the arms: re-parent them onto arm_* / forearm_*
    d.sleeves = d.outfit ? fitSleeves(d.outfit, body) : [];
    d.outfitKey = l.outfit;
  }
  for (const o of [d.outfit, ...d.sleeves]) if (o) setColor(o, 'Outfit_Paint', outfitColor);
  // the vest goes over a white tee; under hood / jacket sleeves the arms keep the outfit colour (no cuff gap shows)
  setColor(body, 'Shirt', l.outfit === 'win_vest' ? RIDER_LOOK.under : outfitColor);
  setAloha(body, l.outfit === 'aloha' ? outfitColor : null, d);

  if (d.gearId !== l.gear) {
    if (d.gear) releasePart(assets, d.gear);
    d.gear = l.gear === 'none' ? null : attach(assets, findNode(bike, gearMountOf(l.gear)) ?? bike, l.gear);
    d.gearId = l.gear;
  }
  if (d.gear) setColor(d.gear, 'Gear_Paint', colorHex(l.gearColor));
  mergeParts(body);
  if (d.gear) mergeParts(d.gear);
}

function releaseOutfit(assets: Assets, d: Dressing): void {
  for (const s of d.sleeves) releasePart(assets, s);
  if (d.outfit) releasePart(assets, d.outfit);
  d.sleeves = [];
  d.outfit = null;
}

/** attachments the first-person view hides outright: helmet, outfit and upper-arm sleeves (forearm sleeves stay) */
export function povHidden(d: Dressing): Object3D[] {
  return [d.helmet, d.outfit, ...d.sleeves.filter(isUpperSleeve)].filter((o): o is Object3D => o !== null);
}

/** flower print on the Shirt material (null = plain) */
function setAloha(body: Object3D, base: string | null, d: Dressing): void {
  const shirts = findMaterials(body, 'Shirt');
  d.aloha?.dispose();
  d.aloha = null;
  for (const [mesh, geo] of d.uvMeshes) {
    mesh.geometry.dispose();
    mesh.geometry = geo;
  }
  d.uvMeshes.length = 0;
  if (!base) {
    for (const m of shirts) {
      m.map = null;
      m.needsUpdate = true;
    }
    return;
  }
  d.aloha = alohaTexture(base);
  body.traverse((o) => {
    if (!isMesh(o) || !usesShirt(o.material)) return;
    d.uvMeshes.push([o, o.geometry]);
    o.geometry = cylinderUv(o.geometry);
  });
  for (const m of shirts) {
    m.color.set('#ffffff');
    m.map = d.aloha;
    m.needsUpdate = true;
  }
}

const usesShirt = (m: Material | Material[]): boolean =>
  (Array.isArray(m) ? m : [m]).some((x) => isStandardMaterial(x) && matchesMaterial(x, 'Shirt'));

/** take the gear off the bike (before the bike itself is swapped or released) */
export function dropGear(assets: Assets, d: Dressing): void {
  if (d.gear) releasePart(assets, d.gear);
  d.gear = null;
  d.gearId = '';
}

/** dispose what dressRider created (not the body/bike themselves) */
export function undress(assets: Assets, d: Dressing): void {
  releaseOutfit(assets, d);
  for (const o of [d.helmet, d.gear]) if (o) releasePart(assets, o);
  d.aloha?.dispose();
  for (const [mesh, geo] of d.uvMeshes) {
    mesh.geometry.dispose();
    mesh.geometry = geo;
  }
  Object.assign(d, emptyDressing());
}
