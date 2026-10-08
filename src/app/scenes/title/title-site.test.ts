import { describe, expect, it } from 'vitest';
import { dist } from '../../../core/math2d';
import { type StaticCollider, Surface } from '../../../core/types';
import { createCityQuery } from '../../../world';
import { pickTitleSite, TITLE_CITY, titleCityData } from './title-site';
import { Sightlines } from '../shared/sightlines';
import { shotCamera, shotTarget, shotYaw } from './title-shot';

const data = titleCityData();
const query = createCityQuery(data);

describe('title showcase site', () => {
  it('is generated from the fixed showcase seed, once per page', () => {
    expect(data.seed).toBe(TITLE_CITY.seed);
    expect(data.district).toBe(TITLE_CITY.district);
    expect(titleCityData()).toBe(data);
  });

  it('frames a signalised junction with the hero parked on a clear kerb close by', () => {
    const site = pickTitleSite(query);
    expect(site.node).toBeGreaterThanOrEqual(0);
    const node = data.nodes[site.node];
    expect(node.signal).toBe(true);
    expect(site.junction).toEqual(node.pos);
    expect(query.surfaceAt(site.hero.x, site.hero.z)).toBe(Surface.Sidewalk);
    const near: StaticCollider[] = [];
    expect(query.staticNear(site.hero, 0.5, near)).toBe(0);
    expect(dist(site.hero, site.junction)).toBeLessThan(42);
  });

  it('keeps the hero and the junction in sight across the whole camera sweep', () => {
    const site = pickTitleSite(query);
    const lines = new Sightlines(query, data);
    for (const phase of [-1, -0.5, 0, 0.5, 1]) {
      const yaw = shotYaw(site.heading, site.shot, phase);
      const cam = shotCamera(shotTarget(site.hero, yaw, site.shot), yaw, site.shot);
      expect(lines.clear(cam, site.hero, 1.2)).toBe(true);
      expect(lines.clear(cam, site.junction, 0.3)).toBe(true);
    }
  });

  it('is deterministic and falls back to the spawn when no candidate is left', () => {
    expect(pickTitleSite(query)).toEqual(pickTitleSite(query));
    const none = pickTitleSite(query, undefined, 999);
    expect(none.node).toBe(-1);
    expect(none.hero).toEqual(data.spawn.pos);
  });
});
