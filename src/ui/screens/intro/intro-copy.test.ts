import { describe, expect, it } from 'vitest';
import type { WeatherPlan } from '../../../core/types/game';
import { auntieLine, distText, etaMinutes, skyChips, two } from './intro-copy';

const clear: WeatherPlan = { base: 'clear', haze: 0.1, events: [] };
const rainy: WeatherPlan = { base: 'overcast', haze: 0.1, events: [{ kind: 'downpour', atProgress: 0.4, duration: 80, intensity: 0.8 }] };

describe('intro copy', () => {
  it('describes the sky as time-of-day · base weather, plus forecast chips', () => {
    expect(skyChips('sunset', clear).map((c) => c.text)).toEqual(['노을 · 맑음']);
    const chips = skyChips('noon', rainy);
    expect(chips.map((c) => c.text)).toEqual(['한낮 · 흐림', '소나기 예보']);
    expect(chips[0].icon).toBe('cloud');
    expect(skyChips('night', { base: 'haze', haze: 0.7, events: [] }).map((c) => c.text)).toEqual(['밤 · 연무', '매연 주의']);
  });

  it('lets 렉 이모 react to the forecast first, then to the first trip', () => {
    expect(auntieLine({ nickname: 'NONG', tripNumber: 1, timeOfDay: 'sunset', weather: rainy })).toContain('소나기');
    expect(auntieLine({ nickname: 'Bee', tripNumber: 1, timeOfDay: 'sunset', weather: clear })).toBe('첫 콜이네, Bee! 천천히, 안전하게~');
    expect(auntieLine({ nickname: '  ', tripNumber: 4, timeOfDay: 'night', weather: clear })).toContain('NONG');
  });

  it('formats distances, pickup ETA and trip numbers', () => {
    expect(distText(320)).toBe('320 m');
    expect(distText(1240)).toBe('1.2 km');
    expect(etaMinutes(20)).toBe(1);
    expect(etaMinutes(900)).toBe(3);
    expect(two(3)).toBe('03');
    expect(two(12)).toBe('12');
  });
});
