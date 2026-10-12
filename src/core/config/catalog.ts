import type { CatalogItem, Loadout } from '../types/save';
import { CUSTOM_COLORS } from './palette';

/**
 * Single source of truth for shop items and prices (docs/GAME_DESIGN.md §11).
 * Colour items are shared by every colourable slot: id `color:<key>`.
 */
const colors: CatalogItem[] = CUSTOM_COLORS.map((c, i) => ({
  id: `color:${c.key}`,
  category: 'color',
  name: c.name,
  hex: c.hex,
  price: i < 4 ? 0 : 60 + i * 15,
  starter: i < 4,
}));

export const CATALOG: CatalogItem[] = [
  { id: 'bike:cub', category: 'bike', ref: 'cub', name: 'Wavey 110', price: 0, starter: true, desc: '가볍고 좁은 스텝스루. 골목의 정석.' },
  { id: 'bike:scooter', category: 'bike', ref: 'scooter', name: 'Kitti 125', price: 900, starter: false, desc: '경쾌한 가속, 넉넉한 발판.' },
  { id: 'bike:sport', category: 'bike', ref: 'sport', name: 'Naga 300', price: 2400, starter: false, desc: '빠르지만 넓다. 큰길의 왕.' },

  { id: 'helmet:helmet_open', category: 'helmet', ref: 'helmet_open', name: '오픈페이스', price: 0, starter: true },
  { id: 'helmet:helmet_half', category: 'helmet', ref: 'helmet_half', name: '하프 + 고글', price: 180, starter: false },
  { id: 'helmet:helmet_full', category: 'helmet', ref: 'helmet_full', name: '풀페이스', price: 320, starter: false },
  { id: 'helmet:helmet_cat', category: 'helmet', ref: 'helmet_cat', name: '고양이 귀', price: 450, starter: false, desc: '손님 첫인상 +1' },

  { id: 'outfit:tee', category: 'outfit', ref: 'tee', name: '기본 티셔츠', price: 0, starter: true },
  { id: 'outfit:win_vest', category: 'outfit', ref: 'win_vest', name: '윈 조끼', price: 150, starter: false, desc: '방콕 오토바이 택시의 상징.' },
  { id: 'outfit:hoodie', category: 'outfit', ref: 'hoodie', name: '후디', price: 220, starter: false },
  { id: 'outfit:track_jacket', category: 'outfit', ref: 'track_jacket', name: '트랙 재킷', price: 380, starter: false },
  { id: 'outfit:aloha', category: 'outfit', ref: 'aloha', name: '플라워 셔츠', price: 600, starter: false },

  { id: 'gear:none', category: 'gear', ref: 'none', name: '없음', price: 0, starter: true },
  { id: 'gear:gear_rack', category: 'gear', ref: 'gear_rack', name: '짐받이 바구니', price: 80, starter: false },
  { id: 'gear:gear_topbox', category: 'gear', ref: 'gear_topbox', name: '탑박스', price: 160, starter: false },
  { id: 'gear:gear_bag', category: 'gear', ref: 'gear_bag', name: 'gram 배달 가방', price: 200, starter: false },
  {
    id: 'gear:gear_cushion', category: 'gear', ref: 'gear_cushion', name: '푹신 방석', price: 140, starter: false,
    desc: '손님 승차감 +3 · 회복 +20%', perk: { start: 3, recovery: 1.2, jolt: 0.9 },
  },
  {
    id: 'gear:gear_backrest', category: 'gear', ref: 'gear_backrest', name: '등받이 지지대', price: 420, starter: false,
    desc: '손님 승차감 +5 · 회복 +35% · 흔들림 −20%', perk: { start: 5, recovery: 1.35, jolt: 0.8 },
  },
  {
    id: 'gear:gear_throne', category: 'gear', ref: 'gear_throne', name: '황금 왕좌', price: 3200, starter: false,
    desc: '손님은 왕이다 👑 승차감 +8 · 회복 +60% · 흔들림 −30%', perk: { start: 8, recovery: 1.6, jolt: 0.7 },
  },

  ...colors,

  { id: 'fuel:1', category: 'fuel', name: '연료 1회', amount: 1, price: 30, starter: false },
  { id: 'fuel:5', category: 'fuel', name: '연료 5회', amount: 5, price: 120, starter: false },
  { id: 'fuel:12', category: 'fuel', name: '연료 12회', amount: 12, price: 250, starter: false },
];

export const STARTER_LOADOUT: Loadout = {
  bike: 'cub',
  bikeColor: 'color:taxi_pink',
  helmet: 'helmet_open',
  helmetColor: 'color:jasmine',
  outfit: 'tee',
  outfitColor: 'color:gram_cyan',
  gear: 'none',
  gearColor: 'color:gram_cyan',
  nickname: 'NONG',
};

export const STARTING_BAHT = 300;
export const STARTING_FUEL = 5;
/** one free fuel every FUEL_REGEN_MINUTES while the tank holds less than FUEL_REGEN_CAP */
export const FUEL_REGEN_MINUTES = 30;
export const FUEL_REGEN_CAP = 5;
/** a free refill is offered at most once every N trips when fuel = 0 and baht < cheapest pack */
export const FREE_REFILL_EVERY = 3;

export const itemById = (id: string): CatalogItem | undefined => CATALOG.find((c) => c.id === id);
export const colorHex = (id: string): string => itemById(id)?.hex ?? '#FFFFFF';
