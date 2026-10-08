/**
 * Menu screens sandbox (sandbox/ui-menu.html): title · garage · shop · setup (+ setup-nofuel) with mock props backed by the
 * real save / economy / forecast logic, chained through their callbacks like the app will. The mockup-03 image stands in
 * for the live 3D backdrop; a dashed ring with a dot stands in for the garage turntable (driven by onRotate).
 * window.__ready once fonts are loaded and the first screen is revealed; window.__menu exposes the last callbacks.
 */
import { CATALOG } from '../core/config/catalog';
import type { TrafficIntensity } from '../core/types/game';
import type { SaveData } from '../core/types/save';
import type { BuyResult, Forecast, Transition } from '../core/types/screens';
import { UI } from '../ui/core/ui';
import { setTitleGate } from '../ui/screens/title';
import '../ui/screens/garage';
import '../ui/screens/shop';
import '../ui/screens/setup';
import { buy, claimFreeRefill, createDefaultSave, equip, freeRefillAvailable, rerollForecast, rollForecast } from '../logic';

interface MenuDebug {
  view: string;
  preview: string;
  rotation: number;
  calls: string[];
}

declare global {
  interface Window {
    __ready?: boolean;
    __menu?: MenuDebug;
  }
}

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'title';
const ui = new UI(document.getElementById('ui') as HTMLElement);
if (q.get('reduced') === '1') ui.setReducedMotion(true);
if (q.get('attract') === '0') setTitleGate(false);
const turntable = document.getElementById('turntable') as HTMLElement;
const dbg: MenuDebug = { view, preview: '', rotation: 0, calls: [] };
window.__menu = dbg;

const log = (line: string): void => {
  dbg.calls.push(line);
  if (dbg.calls.length > 40) dbg.calls.shift();
};
const num = (key: string, fallback: number): number => {
  const v = Number(q.get(key));
  return q.has(key) && Number.isFinite(v) ? v : fallback;
};

function demoSave(): SaveData {
  const base = createDefaultSave();
  const fresh = q.get('fresh') === '1';
  const empty = view === 'setup-nofuel';
  const extras = ['bike:scooter', 'helmet:helmet_half', 'outfit:win_vest', 'gear:gear_rack', 'color:mango', 'color:thai_tea', 'color:tuk_blue'];
  return {
    ...base,
    owned: fresh ? base.owned : [...new Set([...base.owned, ...extras])],
    baht: num('baht', empty ? 20 : fresh ? 300 : 1240),
    fuel: num('fuel', empty ? 0 : fresh ? 5 : 4),
    tripsCompleted: empty ? 6 : fresh ? 0 : 3,
    bestScore: fresh ? 0 : 6820,
    bestGrade: fresh ? base.bestGrade : { light: 'A', rush: 'B', gridlock: null },
    loadout: fresh ? base.loadout : { ...base.loadout, outfit: 'win_vest', outfitColor: 'color:thai_tea', helmetColor: 'color:mango' },
  };
}

let save = demoSave();
const commit = (next: SaveData): SaveData => (save = next);
const onBuy = (id: string): BuyResult => {
  const res = buy(save, id);
  log(`buy ${id} → ${res.ok ? 'ok' : res.reason}`);
  if (res.ok) commit(res.save);
  return res;
};

function showTitle(t: Transition = 'wipe'): void {
  document.body.dataset.view = 'title';
  ui.show('title', {
    save,
    onStart: () => showSetup(),
    onGarage: () => showGarage(),
    onShop: () => showShop(),
    onSettings: () => ui.toast('설정 화면은 screens 에이전트 담당이에요', 'info', 'settings'),
  }, t);
}

function showGarage(t: Transition = 'wipe'): void {
  ui.show('garage', {
    save,
    catalog: CATALOG,
    onPreview: (lo) => {
      dbg.preview = `${lo.bike}/${lo.bikeColor}/${lo.helmet}/${lo.helmetColor}/${lo.outfit}/${lo.outfitColor}/${lo.gear}/${lo.gearColor}/${lo.nickname}`;
      log(`preview ${dbg.preview}`);
    },
    onEquip: (lo) => {
      log(`equip ${lo.bike}/${lo.helmet}/${lo.outfit}/${lo.gear}/${lo.nickname}`);
      return commit(equip(save, lo));
    },
    onBuy,
    onBack: () => showTitle(),
    onShop: () => showShop(),
    onRotate: (d) => {
      dbg.rotation += d;
      turntable.style.setProperty('--a', `${dbg.rotation}rad`);
    },
  }, t, { onCovered: () => (document.body.dataset.view = 'garage') });
}

function showShop(t: Transition = 'wipe'): void {
  ui.show('shop', { save, catalog: CATALOG, onBuy, onBack: () => showTitle() }, t, { onCovered: () => (document.body.dataset.view = 'shop') });
}

function showSetup(t: Transition = 'wipe'): void {
  let intensity: TrafficIntensity = 'rush';
  let forecast: Forecast = rollForecast(20261007, save.tripsCompleted + 1, 1, intensity);
  const handle = ui.show('setup', {
    save,
    forecast,
    onReroll: () => {
      const next = rerollForecast(forecast, intensity);
      log(`reroll → ${next ? `${next.timeOfDay}/${next.weather.base}/${next.district}` : 'none left'}`);
      if (next) forecast = next;
      return next;
    },
    onIntensity: (i) => {
      intensity = i;
      log(`intensity ${i}`);
    },
    onGo: (i) => {
      log(`go ${i}`);
      ui.toast(`출근! ${i} · 연료 −1 (데모)`, 'good', 'bike');
      window.setTimeout(() => showTitle(), 1200);
    },
    onBack: () => showTitle(),
    onBuyFuel: (id) => {
      const res = onBuy(id);
      if (res.ok) handle.update({ save, freeRefillAvailable: freeRefillAvailable(save) });
      return res;
    },
    freeRefillAvailable: freeRefillAvailable(save),
    onFreeRefill: () => {
      commit(claimFreeRefill(save));
      log(`free refill → fuel ${save.fuel}`);
      handle.update({ save, freeRefillAvailable: false });
      return save;
    },
  }, t, { onCovered: () => (document.body.dataset.view = 'setup') });
}

const first: Record<string, () => void> = {
  title: () => showTitle('none'),
  garage: () => showGarage('none'),
  shop: () => showShop('none'),
  setup: () => showSetup('none'),
  'setup-nofuel': () => showSetup('none'),
};
(first[view] ?? first.title)();

void document.fonts.ready.then(() => window.setTimeout(() => requestAnimationFrame(() => (window.__ready = true)), 120));
