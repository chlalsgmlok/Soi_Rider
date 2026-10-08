import { describe, expect, it } from 'vitest';
import { dist } from '../../../core/math2d';
import { createCityQuery, DISTRICT_IDS, generateCity } from '../../../world';
import { findStandSite } from './stand-site';

describe('intro stand site', () => {
  for (const district of DISTRICT_IDS) {
    it(`finds the home win stand and Lek's cart next to the spawn (${district})`, () => {
      const data = generateCity(11, district);
      const site = findStandSite(createCityQuery(data));
      expect(site.spawn).toBe(data.spawn);
      expect(site.stand?.meta?.home).toBe('1');
      expect(site.cart?.meta?.story).toBe('lek');
      if (!site.cart || !site.lek || !site.stand) throw new Error('missing stand scene');
      expect(dist(site.lek.pos, site.cart.pos)).toBeLessThan(2.5);
      expect(dist(site.stand.pos, data.spawn.pos)).toBeLessThan(8);
      expect(dist(site.focus, data.spawn.pos)).toBeLessThan(dist(site.cart.pos, data.spawn.pos));
    });
  }
});
