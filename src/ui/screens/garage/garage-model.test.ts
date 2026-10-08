import { describe, expect, it } from 'vitest';
import type { SaveData } from '../../../core/types/save';
import { buy, equip } from '../../../logic/economy';
import { createDefaultSave } from '../../../logic/save-defaults';
import { GarageModel } from './garage-model';

const rich = (): SaveData => ({ ...createDefaultSave(), baht: 10_000 });

function bought(save: SaveData, ...ids: string[]): SaveData {
  return ids.reduce((s, id) => {
    const res = buy(s, id);
    if (!res.ok) throw new Error(`could not buy ${id}: ${res.reason}`);
    return res.save;
  }, save);
}

describe('GarageModel', () => {
  it('starts with a copy of the saved loadout and nothing to settle', () => {
    const save = rich();
    const m = new GarageModel(save);
    expect(m.preview).toEqual(save.loadout);
    expect(m.preview).not.toBe(save.loadout);
    expect(m.changes()).toBe(0);
    expect(m.dirty()).toBe(false);
    expect(m.unowned()).toEqual([]);
  });

  it('counts every slot that differs and lists the ones not bought yet', () => {
    const m = new GarageModel(bought(rich(), 'helmet:helmet_half'));
    m.select('bike', 'sport');
    m.select('helmet', 'helmet_half');
    m.select('helmetColor', 'color:chili_red');
    expect(m.changes()).toBe(3);
    expect(m.dirty()).toBe(true);
    expect(m.unowned().map((it) => it.id).sort()).toEqual(['bike:sport', 'color:chili_red']);
    expect(m.unownedTotal()).toBe(m.unowned().reduce((sum, it) => sum + it.price, 0));
    expect(m.unownedTotal()).toBeGreaterThan(2400);
  });

  it('ownedOnly keeps owned picks and puts unbought slots back to the saved value', () => {
    const save = bought(rich(), 'helmet:helmet_half');
    const m = new GarageModel(save);
    m.select('bike', 'sport');
    m.select('helmet', 'helmet_half');
    m.select('outfitColor', 'color:chili_red');
    const kept = m.ownedOnly();
    expect(kept.bike).toBe(save.loadout.bike);
    expect(kept.outfitColor).toBe(save.loadout.outfitColor);
    expect(kept.helmet).toBe('helmet_half');
    expect(m.preview.bike).toBe('sport');
  });

  it('counts a nickname change only when the trimmed name is new and not blank', () => {
    const m = new GarageModel(rich());
    m.setNickname('   ');
    expect(m.changes()).toBe(0);
    m.setNickname(` ${m.save.loadout.nickname} `);
    expect(m.changes()).toBe(0);
    m.setNickname(' BEE ');
    expect(m.changes()).toBe(1);
    expect(m.dirty()).toBe(true);
  });

  it('keeps the preview across purchases, and commit / revert reset it to the saved loadout', () => {
    const m = new GarageModel(rich());
    m.select('bike', 'sport');
    m.setSave(bought(m.save, 'bike:sport'));
    expect(m.preview.bike).toBe('sport');
    expect(m.unowned()).toEqual([]);
    expect(m.changes()).toBe(1);

    m.commit(equip(m.save, m.preview));
    expect(m.save.loadout.bike).toBe('sport');
    expect(m.preview).toEqual(m.save.loadout);
    expect(m.dirty()).toBe(false);

    m.select('gear', 'gear_bag');
    m.revert();
    expect(m.preview).toEqual(m.save.loadout);
    expect(m.dirty()).toBe(false);
  });

  it('notifies listeners on real changes only, until unsubscribed', () => {
    const m = new GarageModel(rich());
    let calls = 0;
    const off = m.on(() => calls++);
    m.select('bike', m.preview.bike);
    m.setNickname(m.preview.nickname);
    expect(calls).toBe(0);
    m.select('bike', 'scooter');
    m.setNickname('KAI');
    expect(calls).toBe(2);
    off();
    m.revert();
    expect(calls).toBe(2);
  });
});
