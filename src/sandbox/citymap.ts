/**
 * Top-down city generator viewer.
 * sandbox/citymap.html?seed=7&district=sukhumvit&zoom=2.5&cx=0&cz=0&lanes=1&conn=1&props=1&col=0&focus=spawn|poi:3|signal:0|lot:temple
 * Drag to pan, wheel to zoom, keys: L lanes · C connectors · P props · K colliders · N next seed · D next district.
 * Sets window.__ready and window.__stats (generation ms + counts).
 */
import type { CityData, DistrictId } from '../core/types';
import { DISTRICTS, DISTRICT_IDS, generateCity, createCityQuery, buildSurfaceMap } from '../world';
import { drawCityMap, surfaceImage, type MapLayers, type MapView } from '../world/gen/city-map-render';
import { SURFACE_COLORS } from '../world/gen/city-map-render';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: Record<string, number | string>;
  }
}

const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (q.has(k) ? Number(q.get(k)) : d);
const flag = (k: string, d: boolean): boolean => (q.has(k) ? q.get(k) !== '0' : d);

let seed = num('seed', 1);
let district = (q.get('district') ?? 'sukhumvit') as DistrictId;
const layers: MapLayers = {
  lanes: flag('lanes', true), connectors: flag('conn', true), placements: flag('props', true),
  colliders: flag('col', false), pois: flag('pois', true),
};
const canvas = document.getElementById('map') as HTMLCanvasElement;
const panel = document.getElementById('panel') as HTMLDivElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const view: MapView = { cx: num('cx', 0), cz: num('cz', 0), scale: num('zoom', 0), width: 0, height: 0 };

let data: CityData;
let img: HTMLCanvasElement;
let map: ReturnType<typeof buildSurfaceMap>;

function build(): void {
  const t0 = performance.now();
  data = generateCity(seed, district);
  const genMs = performance.now() - t0;
  const warm: number[] = [];
  for (let k = 0; k < 5; k++) {
    const t1 = performance.now();
    generateCity(seed + k + 1, district);
    warm.push(performance.now() - t1);
  }
  const warmMs = warm.sort((a, b) => a - b)[2];
  const query = createCityQuery(data);
  map = buildSurfaceMap(data);
  img = surfaceImage(map);
  const signals = data.nodes.filter((n) => n.signal).length;
  const oneWay = new Set(data.edges.filter((e) => e.oneWay).map((e) => e.name)).size;
  window.__stats = {
    seed, district, genMs: Math.round(genMs * 10) / 10, warmMs: Math.round(warmMs * 10) / 10, nodes: data.nodes.length, edges: data.edges.length,
    lanes: data.lanes.length, connectors: data.connectors.length, signals, oneWaySois: oneWay,
    pois: data.pois.length, placements: data.placements.length, colliders: data.colliders.length,
    frontages: data.frontages.length, spawnRoad: query.roadNameAt(data.spawn.pos),
  };
  renderPanel();
}

function renderPanel(): void {
  const d = DISTRICTS[district];
  const s = window.__stats ?? {};
  const rows = Object.entries(s).filter(([k]) => k !== 'seed' && k !== 'district').map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  const legend = ['Road', 'Sidewalk', 'Median', 'Building', 'Plaza', 'Crosswalk', 'Intersection']
    .map((n, i) => `<span style="background:rgb(${SURFACE_COLORS[i + 1].join(',')})"></span>${n}`).join(' ');
  panel.innerHTML = `<h1>${d.label.ko} · ${d.label.en} <span class="th">${d.label.th}</span></h1>
    <div>seed <b>${seed}</b></div><table>${rows}</table><div class="legend">${legend}</div>
    <div class="keys">L lanes · C connectors · P props · K colliders · N seed+1 · D district</div>`;
}

/** centre the view: 'spawn', 'poi:<id>', 'signal:<k>' (k-th signalised junction) or 'lot:<kind>' (temple, park, …) */
function focusOn(focus: string): void {
  const [kind, arg] = focus.split(':');
  let p: { x: number; z: number } | undefined;
  if (kind === 'spawn') p = data.spawn.pos;
  else if (kind === 'poi') p = data.pois[Number(arg)]?.pos;
  else if (kind === 'signal') p = data.nodes.filter((n) => n.signal)[Number(arg)]?.pos;
  else if (kind === 'lot') p = data.placements.find((x) => x.meta?.lot === arg)?.pos;
  if (p) [view.cx, view.cz] = [p.x, p.z];
}

function draw(): void {
  view.width = canvas.width = innerWidth;
  view.height = canvas.height = innerHeight;
  if (view.scale <= 0) view.scale = Math.min(innerWidth, innerHeight) / (data.bounds.maxX - data.bounds.minX + 20);
  drawCityMap(ctx, data, img, map, view, layers);
}

let drag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY }));
addEventListener('pointerup', () => (drag = null));
addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.cx -= (e.clientX - drag.x) / view.scale;
  view.cz -= (e.clientY - drag.y) / view.scale;
  drag = { x: e.clientX, y: e.clientY };
  draw();
});
canvas.addEventListener('wheel', (e) => {
  view.scale *= e.deltaY < 0 ? 1.15 : 1 / 1.15;
  draw();
});
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'l') layers.lanes = !layers.lanes;
  else if (k === 'c') layers.connectors = !layers.connectors;
  else if (k === 'p') layers.placements = !layers.placements;
  else if (k === 'k') layers.colliders = !layers.colliders;
  else if (k === 'n') (seed += 1), build();
  else if (k === 'd') (district = DISTRICT_IDS[(DISTRICT_IDS.indexOf(district) + 1) % DISTRICT_IDS.length]), build();
  else return;
  draw();
});
addEventListener('resize', draw);

build();
focusOn(q.get('focus') ?? '');
draw();
window.__ready = true;
