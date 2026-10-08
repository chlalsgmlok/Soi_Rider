import { CATALOG } from '../../../core/config/catalog';
import type { CityData, JobOffer, Loadout, SaveData, TimeOfDay } from '../../../core/types';
import { buy, createDefaultSave, equip } from '../../../logic';
import { UI } from '../../../ui/core/ui';
import '../../../ui/screens/garage';
import '../../../ui/screens/intro';
import { setTitleGate } from '../../../ui/screens/title';

/**
 * Dev only (sandbox/scenes.html &ui=1): mounts the real menu screen over a backdrop with throw-away props so the
 * composition can be judged as the player sees it — and the garage / intro callbacks drive the 3D scene.
 */
function ui(): UI {
  let el = document.getElementById('ui');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ui';
    document.body.append(el);
  }
  return new UI(el);
}

const noop = (): void => undefined;

export function demoSave(loadout: Loadout): SaveData {
  const base = createDefaultSave();
  return { ...base, baht: 1240, fuel: 4, tripsCompleted: 3, bestScore: 6820, loadout };
}

/** `gate` = the first-visit "press any key" state instead of the menu */
export function showTitleUi(save: SaveData, gate: boolean): void {
  setTitleGate(gate);
  ui().show('title', { save, onStart: noop, onGarage: noop, onShop: noop, onSettings: noop }, 'none');
}

export function showGarageUi(save: SaveData, scene: { applyLoadout(l: Loadout): void; rotate(d: number): void }): void {
  let s = save;
  ui().show('garage', {
    save: s,
    catalog: CATALOG,
    onPreview: (l) => scene.applyLoadout(l),
    onEquip: (l) => {
      s = equip(s, l);
      scene.applyLoadout(l);
      return s;
    },
    onBuy: (id) => {
      const res = buy(s, id);
      if (res.ok) s = res.save;
      return res;
    },
    onBack: noop,
    onShop: noop,
    onRotate: (d) => scene.rotate(d),
  }, 'none');
}

export function showIntroUi(data: CityData, offers: JobOffer[], tod: TimeOfDay, onAccept: () => void): void {
  ui().show('intro', {
    tripNumber: 3, nickname: 'NONG', districtLabel: '수쿰빗', timeOfDay: tod,
    weather: { base: 'clear', haze: 0.1, events: [] }, offers,
    poiName: (id) => data.pois.find((p) => p.id === id)?.name ?? `POI ${id}`,
    secondsToChoose: 20, onAccept,
  }, 'none');
}
