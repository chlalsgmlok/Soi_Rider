import { RIDE } from '../../core/config/bikes';
import type { GameEvents } from '../../core/events';
import { clamp } from '../../core/math2d';
import type { Vec2, VehicleKind } from '../../core/types';
import { sfx, type AudioCue } from './audio-cue';

/** Pure mappers: riding / traffic game events → sound cues. */

/** contact speed (km/h) that counts as a full-intensity hit */
const FULL_HIT_KMH = 35;
const KINDS: readonly VehicleKind[] = ['songthaew', 'tuktuk', 'pickup', 'sedan', 'taxi', 'moto', 'van', 'bus'];

const hit = (kmh: number): number => clamp((Number.isFinite(kmh) ? kmh : 0) / FULL_HIT_KMH, 0.15, 1);

/** best effort: the collision's `other` label may name the vehicle ("taxi#12", "npc:bus") */
export function kindIn(label: string): VehicleKind | null {
  const l = label.toLowerCase();
  return KINDS.find((k) => l.includes(k)) ?? null;
}

function heavyHit(pos: Vec2, i: number): AudioCue[] {
  return [
    sfx('crash', { pos, intensity: i }),
    { do: 'muffle', amount: 0.4 + 0.3 * i, hold: 0.55 },
    { do: 'duck', amount: 0.5, seconds: 1.4 },
  ];
}

/** the other driver leans on the horn after you touched their car */
function angryDriver(kind: VehicleKind | null, pos: Vec2): AudioCue[] {
  return kind ? [{ do: 'npcHorn', kind, pos, pattern: kind === 'tuktuk' ? undefined : 'angry', delay: 0.4 }] : [];
}

export function collisionCues(p: GameEvents['collision']): AudioCue[] {
  const i = hit(p.speedKmh);
  const pos = p.point;
  switch (p.kind) {
    case 'mirror':
      return p.heavy
        ? [sfx('mirror_clack', { pos, intensity: i }), sfx('bump', { pos, intensity: i * 0.6, delay: 0.02 })]
        : [sfx('mirror_clack', { pos, intensity: i, gain: 0.6 + 0.4 * i })];
    case 'curb':
      return [sfx('curb', { pos, intensity: i })];
    case 'pedestrian':
      return [
        sfx('thud_ped', { pos, intensity: i }),
        sfx('gasp', { pos, pitch: 1.15, delay: 0.06 }),
        { do: 'muffle', amount: 0.3, hold: 0.35 },
      ];
    case 'moto': {
      const body = p.heavy
        ? heavyHit(pos, i)
        : [sfx('bump', { pos, intensity: i, pitch: 1.2 }), sfx('mirror_clack', { pos, intensity: i * 0.7, gain: 0.5 })];
      return [...body, ...angryDriver('moto', pos)];
    }
    case 'static':
      return p.heavy ? heavyHit(pos, i) : [sfx('bump', { pos, intensity: i, pitch: 0.85 })];
    case 'body':
      return [...(p.heavy ? heavyHit(pos, i) : [sfx('bump', { pos, intensity: i })]), ...angryDriver(kindIn(p.other), pos)];
  }
}

export function fallCues(p: GameEvents['player:fall']): AudioCue[] {
  const slid = /skid|slip|grip|wet|low.?side/i.test(p.reason);
  return [
    ...(slid ? [sfx('skid', { intensity: 0.9 })] : []),
    sfx('scrape', { intensity: 0.8, delay: slid ? 0.25 : 0.05 }),
    { do: 'stall', seconds: RIDE.fallDuration + 0.4 },
    { do: 'muffle', amount: 0.65, hold: 1.1 },
    { do: 'duck', amount: 0.6, seconds: RIDE.fallDuration },
  ];
}

export const RECOVER_CUES: readonly AudioCue[] = [{ do: 'restart' }];

export function nearMissCues(p: GameEvents['nearMiss']): AudioCue[] {
  const tight = 1 - clamp(p.clearanceCm / 20, 0, 1);
  return [
    sfx('whoosh', { side: p.side, speedKmh: p.speedKmh, intensity: 0.45 + 0.55 * tight }),
    sfx('combo', { combo: Math.max(1, p.combo), delay: 0.04 }),
  ];
}

export function perfectGapCues(p: GameEvents['perfectGap']): AudioCue[] {
  return [
    sfx('whoosh', { side: 'left', speedKmh: 25, intensity: 0.8 }),
    sfx('whoosh', { side: 'right', speedKmh: 25, intensity: 0.8, delay: 0.07 }),
    sfx('perfect', { combo: p.combo, delay: 0.03 }),
  ];
}

export const filterPassCues = (p: GameEvents['filterPass']): AudioCue[] => [sfx('filter_pass', { combo: p.total })];

export const comboEndCues = (p: GameEvents['combo:end']): AudioCue[] => (p.combo >= 3 ? [sfx('combo_cash', { combo: p.combo })] : []);

export function hornCues(p: GameEvents['horn'], fallbackKind: () => VehicleKind): AudioCue[] {
  if (p.by === 'player') return [{ do: 'hornTap' }];
  return [{ do: 'npcHorn', kind: p.kind ?? fallbackKind(), pos: p.pos }];
}

export function splashCues(p: GameEvents['splash']): AudioCue[] {
  const cues: AudioCue[] = [sfx('splash', { pos: p.pos, intensity: 0.8 })];
  if (p.onPedestrian) cues.push(sfx('gasp', { pos: p.pos, pitch: 1.2, delay: 0.1 }), sfx('grumble', { pos: p.pos, delay: 0.6 }));
  return cues;
}

export const warnCues = (active: boolean): AudioCue[] => (active ? [sfx('warn')] : []);

export const RED_LIGHT_CUES: readonly AudioCue[] = [sfx('warn'), sfx('police_whistle', { pan: 0.35, gain: 0.85, delay: 0.3 })];
