/** Top-left: "03 / BANGKOK", underline, district plate + road name, weather chip. */
import type { HudState } from '../../core/types/hud';
import type { TimeOfDay } from '../../core/types/game';
import type { HudWidget } from './types';
import { h } from '../core/h';
import { icon, setIcon } from '../icons/icon';
import { pop } from '../core/animate';
import { weatherGlyph } from './labels';

export class TripTag implements HudWidget {
  readonly el: HTMLElement;
  private no = h('span.hud-trip__no', '01');
  private city = h('span.hud-trip__city', 'BANGKOK');
  private district = h('span.soi-plate__en', 'SUKHUMVIT');
  private road = h('span.hud-trip__road-name', '');
  private weatherIcon = icon('sun', 16);
  private weatherText = h('span.chip__text', '');
  private weatherChip = h('span.chip.hud-trip__weather', this.weatherIcon, this.weatherText);
  private cache = { trip: -1, city: '', district: '', road: '', weather: '' };
  private tod: TimeOfDay = 'sunset';

  constructor() {
    this.el = h(
      'div.hud-trip',
      h('div.hud-trip__title', this.no, h('span.hud-trip__slash', '/'), this.city),
      h('div.hud-trip__rule'),
      h('div.hud-trip__road', h('span.soi-plate.soi-plate--mini', this.district), this.road),
      h('div.hud-trip__chips', this.weatherChip),
    );
  }

  setTimeOfDay(tod: TimeOfDay): void {
    this.tod = tod;
    this.cache.weather = '';
  }

  update(s: HudState): void {
    const c = this.cache;
    if (s.tripNumber !== c.trip) {
      c.trip = s.tripNumber;
      this.no.textContent = String(s.tripNumber).padStart(2, '0');
    }
    const city = s.city.toUpperCase();
    if (city !== c.city) this.city.textContent = c.city = city;
    const district = s.district.toUpperCase();
    if (district !== c.district) this.district.textContent = c.district = district;
    if (s.roadName !== c.road) {
      c.road = s.roadName;
      this.road.textContent = s.roadName;
      if (s.roadName) pop(this.road, { from: 0.92 });
    }
    const w = weatherGlyph(s.weather, s.rain, this.tod);
    const key = `${w.icon}|${w.label}|${w.tone}`;
    if (key !== c.weather) {
      const first = c.weather === '';
      c.weather = key;
      setIcon(this.weatherIcon, w.icon);
      this.weatherText.textContent = w.label;
      this.weatherChip.className = `chip hud-trip__weather${w.tone !== 'neutral' ? ` chip--${w.tone}` : ''}`;
      if (!first) pop(this.weatherChip, { from: 0.7 });
    }
  }
}
