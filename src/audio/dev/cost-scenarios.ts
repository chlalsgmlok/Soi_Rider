import type { SelfTestCase } from './self-test-cases';

/** Typical game situations for measuring the sound graph's CPU cost offline (see `renderCost`). */
const SECONDS = 8;

const cruise = (rain: number, night: number): SelfTestCase => ({
  name: rain > 0 ? 'riding_rain_night' : 'riding_day', group: 'engine', seconds: SECONDS, tick: true,
  start: (g) => {
    g.beds.set({ city: 0.8, rain, wind: 0.2 + rain * 0.4, night }, 0.2, 0);
    g.music.play(night > 0 ? 'ride_night' : 'ride_day', 0.05);
  },
  step: (g, t) => {
    g.engine.set(0.45, 0.6, 0.5, t);
    g.ride.set(35, rain, 0, t);
  },
});

export const COST_SCENARIOS: readonly SelfTestCase[] = [
  /** menus with no ambience: everything parked */
  { name: 'idle', group: 'engine', seconds: SECONDS, start: () => undefined },
  /** same, with the 25 ms control steps — calibrates the offline suspend/resume overhead */
  { name: 'idle_ticked', group: 'engine', seconds: SECONDS, tick: true, start: () => undefined },
  /** title / garage: music + light city bed */
  {
    name: 'menu_music', group: 'music', seconds: SECONDS, tick: true,
    start: (g) => {
      g.beds.set({ city: 0.4 }, 0.2, 0);
      g.music.play('title', 0.05);
    },
  },
  cruise(0, 0),
  cruise(0.9, 1),
];
