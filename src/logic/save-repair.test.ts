import { describe, expect, it } from 'vitest';
import { STARTER_LOADOUT } from '../core/config/catalog';
import { createDefaultSave, NEVER_REFILLED } from './save-defaults';
import { repairSave } from './save-repair';

describe('repairSave', () => {
  it('replaces non-object roots with a default save', () => {
    for (const raw of ['hello', 42, null, [], undefined]) {
      const r = repairSave(raw);
      expect(r.save).toEqual(createDefaultSave());
      expect(r.repaired).toEqual(['root']);
    }
  });

  it('reports nothing for clean data', () => {
    expect(repairSave(JSON.parse(JSON.stringify(createDefaultSave()))).repaired).toEqual([]);
    const { fuelRegenAt: _clock, ...older } = createDefaultSave(); // saves from before the fuel refill clock
    expect(repairSave(older)).toMatchObject({ repaired: [], save: { fuelRegenAt: 0 } });
  });

  it('clamps and fixes numbers', () => {
    const r = repairSave({ ...createDefaultSave(), baht: 'lots', fuel: -5, tripsCompleted: 3.6, bestScore: Infinity });
    expect(r.save.baht).toBe(300);
    expect(r.save.fuel).toBe(0);
    expect(r.save.tripsCompleted).toBe(4);
    expect(r.save.bestScore).toBe(0);
    expect(r.repaired).toEqual(expect.arrayContaining(['baht', 'fuel', 'tripsCompleted', 'bestScore']));
  });

  it('filters unknown / consumable / non-string owned entries and re-adds starters', () => {
    const r = repairSave({ ...createDefaultSave(), owned: ['bike:rocket', 'fuel:5', 42, 'bike:sport', 'bike:sport'] });
    expect(r.save.owned).toContain('bike:sport');
    expect(r.save.owned).toContain('bike:cub');
    expect(r.save.owned).not.toContain('bike:rocket');
    expect(r.save.owned).not.toContain('fuel:5');
    expect(r.save.owned.filter((id) => id === 'bike:sport')).toHaveLength(1);
    expect(r.repaired).toContain('owned');
  });

  it('only keeps equipped items that exist and are owned', () => {
    const base = createDefaultSave();
    const r = repairSave({
      ...base,
      owned: [...base.owned, 'bike:sport', 'color:neon_purple'],
      loadout: { ...base.loadout, bike: 'sport', bikeColor: 'color:neon_purple', helmet: 'helmet_full', outfit: 'spacesuit',
        gearColor: 'color:leaf_green', nickname: '   ' },
    });
    expect(r.save.loadout.bike).toBe('sport');
    expect(r.save.loadout.bikeColor).toBe('color:neon_purple');
    expect(r.save.loadout.helmet).toBe('helmet_open');
    expect(r.save.loadout.outfit).toBe('tee');
    expect(r.save.loadout.gearColor).toBe('color:gram_cyan');
    expect(r.save.loadout.nickname).toBe('NONG');
    expect(r.repaired).toEqual(expect.arrayContaining(['loadout.helmet', 'loadout.outfit', 'loadout.gearColor', 'loadout.nickname']));
  });

  it('limits nicknames to 12 characters', () => {
    const r = repairSave({ ...createDefaultSave(), loadout: { ...STARTER_LOADOUT, nickname: '  ABCDEFGHIJKLMNOP ' } });
    expect(r.save.loadout.nickname).toBe('ABCDEFGHIJKL');
  });

  it('repairs settings, best grades and the refill marker', () => {
    const r = repairSave({
      ...createDefaultSave(), tripsCompleted: 2, freeRefillAtTrip: 99,
      bestGrade: { light: 'Z', rush: 'A' },
      settings: { master: 3, music: -1, sfx: 'loud', quality: 'ultra', camera: 'pov', minimap: 'yes', reducedMotion: true, touch: 'on' },
    });
    expect(r.save.freeRefillAtTrip).toBe(NEVER_REFILLED);
    expect(r.save.bestGrade).toEqual({ light: null, rush: 'A', gridlock: null });
    expect(r.save.settings).toEqual({
      master: 1, music: 0, sfx: 0.8, quality: 'auto', camera: 'pov', minimap: true, reducedMotion: true, touch: 'on',
    });
  });
});
