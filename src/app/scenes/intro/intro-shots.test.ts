import { describe, expect, it } from 'vitest';
import { newPose } from '../../../camera';
import { createCityQuery, DISTRICT_IDS, generateCity } from '../../../world';
import { Sightlines } from '../shared/sightlines';
import { highPose, INTRO_SHOT, standOffset } from './intro-shots';
import { findStandSite } from './stand-site';

describe('intro shots', () => {
  for (const district of DISTRICT_IDS) {
    it(`see the rider at the stand and from the establishing height (${district})`, () => {
      const data = generateCity(23, district);
      const query = createCityQuery(data);
      const lines = new Sightlines(query, data);
      const site = findStandSite(query);
      const high = highPose(lines, site, 0, newPose());
      expect(lines.clear(high.pos, site.spawn.pos, 1)).toBe(true);
      expect(high.pos.y).toBeGreaterThanOrEqual(INTRO_SHOT.high.up);
      expect(high.fov).toBe(INTRO_SHOT.high.fov);
      const n = standOffset(lines, site, 0);
      expect(Math.abs(n.back) + Math.abs(n.right) + Math.abs(n.up)).toBeLessThan(6);
    });
  }
});
