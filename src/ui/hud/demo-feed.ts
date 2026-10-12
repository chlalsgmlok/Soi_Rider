/**
 * Dev harness data for sandbox/ui.html: a synthetic HudState stream (speed oscillation, tight gaps, comfort drift,
 * draining prompt, counterflow window), a grid MapSource and a looping event script. Not used by the game itself.
 */
import type { HudState, PromptState } from '../../core/types/hud';
import type { MissionPhase, PassengerProfile } from '../../core/types/game';
import type { Vec2, ScreenPoint } from '../../core/types/geometry';
import type { GameEvents } from '../../core/events';
import type { MapRoad, MapSource } from './types';
import { wrapAngle } from '../../core/math2d';

export const DEMO_PASSENGER: PassengerProfile = {
  id: 'demo-mali',
  name: '말리 (Mali)',
  origin: '방콕 직장인',
  trait: 'hurry',
  rating: 4.8,
  look: { skin: '#D9A47A', shirt: '#F2559A', pants: '#2B3A5C', hair: 'hair_long', hairColor: '#1E1B1A' },
};

export const DEMO_PROMPT: PromptState = { id: 'raincoat', title: '소나기!', text: '잠깐 멈추고 손님에게 우비 건네기', key: 'E', progress: 1 };

/** grid city: avenues every 70 m (x), sois every 55 m (z), Sukhumvit main road on x = 0 */
export function demoMapSource(): MapSource {
  const roads: MapRoad[] = [];
  for (let x = -420; x <= 420; x += 70) roads.push({ a: { x, z: -400 }, b: { x, z: 900 }, width: x === 0 ? 16 : 7, cls: x === 0 ? 'main' : 'soi' });
  for (let z = -385; z <= 880; z += 55) roads.push({ a: { x: -420, z }, b: { x: 420, z }, width: z % 165 === 0 ? 11 : 6, cls: z % 165 === 0 ? 'avenue' : 'soi' });
  return (c, r) => roads.filter((rd) => Math.abs(rd.a.x - c.x) < r + 20 || Math.abs(rd.a.z - c.z) < r + 20);
}

export interface DemoAnchors {
  bike: ScreenPoint;
  left: ScreenPoint;
  right: ScreenPoint;
}

/** screen anchors that line up with the riders in the reference mockups at 1280×720 */
export function mockupAnchors(bg: string, w: number, hgt: number): DemoAnchors {
  const sx = w / 1280;
  const sy = hgt / 720;
  const p = (x: number, y: number): ScreenPoint => ({ x: x * sx, y: y * sy });
  return bg === '02'
    ? { bike: p(640, 470), left: p(476, 368), right: p(905, 372) }
    : { bike: p(628, 470), left: p(566, 470), right: p(694, 470) };
}

const wave = (t: number, period: number, lo: number, hi: number, phase = 0): number => lo + (hi - lo) * (0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2 + phase));

export function demoState(t: number, anchors: DemoAnchors, promptAt: number | null, phase: MissionPhase = 'toDropoff'): HudState {
  const speed = wave(t, 7, 6, 31);
  const z = 30 + t * 4.2;
  const pos: Vec2 = { x: Math.sin(t * 0.3) * 1.5, z };
  const heading = Math.sin(t * 0.4) * 0.12;
  const route: Vec2[] = [pos, { x: 0, z: 150 }, { x: 70, z: 165 }, { x: 70, z: 260 }];
  const remaining = Math.max(12, 150 - z) + 72 + 95;
  const leftCm = wave(t, 3.1, 4, 38);
  const rightCm = wave(t, 4.3, 12, 52, 1.3);
  const cyc = t % 12;
  const pp = promptAt === null ? -1 : t - promptAt;
  return {
    tripNumber: 3,
    city: 'Bangkok',
    district: 'Sukhumvit',
    roadName: cyc < 6 ? 'Soi 23 · ซอย 23' : 'Sukhumvit Rd',
    phase,
    targetMeters: remaining,
    // HudState: + = right; sim heading grows to the LEFT, so bearing = heading − headingTo(target)
    targetBearing: wrapAngle(heading - Math.atan2(70 - pos.x, 165 - pos.z)),
    targetScreen: null,
    speedKmh: speed,
    etaLeftSec: 192 - t * 6,
    elapsedSec: t,
    comfort: wave(t, 9, 28, 92),
    passenger: phase === 'intro' ? null : DEMO_PASSENGER,
    clearance: {
      leftCm: leftCm < 30 ? leftCm : null,
      rightCm: rightCm < 30 ? rightCm : null,
      leftScreen: { x: anchors.left.x + Math.sin(t * 2.1) * 4, y: anchors.left.y + Math.cos(t * 1.7) * 2 },
      rightScreen: { x: anchors.right.x + Math.sin(t * 1.9) * 4, y: anchors.right.y },
    },
    combo: Math.floor(t % 6),
    weather: t % 20 < 10 ? 'rain' : 'clear',
    rain: 0.7,
    prompt: pp >= 0 && pp < 8 ? { ...DEMO_PROMPT, progress: 1 - pp / 8 } : null,
    cameraMode: t % 16 < 8 ? 'auto' : 'diorama',
    counterflow: cyc > 7 && cyc < 9.5,
    centerline: cyc > 4 && cyc < 6.5,
    onSidewalk: false,
    tucking: leftCm < 12,
    minimap: { playerPos: pos, playerHeading: heading, target: { x: 70, z: 260 }, route },
    bikeScreen: anchors.bike,
  };
}

type Cue = { [K in keyof GameEvents]: { at: number; type: K; payload: GameEvents[K] } }[keyof GameEvents];

const pts = (combo: number): number => Math.round(40 * (1 + 0.25 * combo));

/** looping event script (seconds within a 10 s cycle) */
export const DEMO_SCRIPT: Cue[] = [
  { at: 0.4, type: 'passenger:say', payload: { text: '기사님, 7시까지 갈 수 있을까요?', mood: 'neutral' } },
  { at: 1.1, type: 'nearMiss', payload: { clearanceCm: 14, speedKmh: 18, side: 'left', combo: 1, points: pts(1) } },
  { at: 1.6, type: 'nearMiss', payload: { clearanceCm: 9, speedKmh: 19, side: 'right', combo: 2, points: pts(2) } },
  { at: 2.1, type: 'nearMiss', payload: { clearanceCm: 6, speedKmh: 17, side: 'left', combo: 3, points: pts(3) } },
  { at: 2.6, type: 'perfectGap', payload: { leftCm: 6, rightCm: 12, combo: 4, points: 300 } },
  { at: 3.2, type: 'filterPass', payload: { total: 4 } },
  { at: 3.4, type: 'story:prompt', payload: DEMO_PROMPT },
  { at: 3.6, type: 'passenger:say', payload: { text: '앗, 비 온다! 우비 있어요?', mood: 'wet' } },
  { at: 6.4, type: 'story:resolve', payload: { id: 'raincoat', success: true } },
  { at: 7.0, type: 'mission:phase', payload: { phase: 'arriving', prev: 'toDropoff' } },
  { at: 7.4, type: 'toast', payload: { text: '손님이 우비를 입었어요 · 승차감 +12', tone: 'good', icon: 'raincoat' } },
  { at: 8.6, type: 'collision', payload: { kind: 'mirror', heavy: false, speedKmh: 12, point: { x: 0, z: 0 }, other: 'taxi' } },
  { at: 8.8, type: 'passenger:say', payload: { text: '으악! 미러 닿았어요!', mood: 'scared' } },
];
