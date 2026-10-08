import type { TimeOfDay, TrafficIntensity, WeatherKind } from '../core/types';
import type { AmbienceLevels, MusicTrack } from './types';

/** Which music and which ambience fit a run's conditions (pure lookups for the app). */

/** riding music for the time of day: the day groove until it is properly dark */
export const rideTrack = (tod: TimeOfDay): MusicTrack => (tod === 'night' ? 'ride_night' : 'ride_day');

/** wind bed level per weather */
export const WEATHER_WIND: Readonly<Record<WeatherKind, number>> = { clear: 0.08, haze: 0.04, overcast: 0.22, rain: 0.5 };

const CITY: Readonly<Record<TrafficIntensity, number>> = { light: 0.55, rush: 0.8, gridlock: 1 };
/** cicadas start at dusk in Bangkok */
const INSECTS: Readonly<Record<TimeOfDay, number>> = { morning: 0.1, noon: 0, sunset: 0.35, night: 1 };

/** ambience bed levels at the start of a run (weather events then ramp them via bindAudio) */
export function ambienceFor(intensity: TrafficIntensity, tod: TimeOfDay, weather: WeatherKind, rain = 0): AmbienceLevels {
  return {
    city: CITY[intensity] * (tod === 'night' ? 0.75 : 1),
    rain: weather === 'rain' ? Math.min(1, Math.max(0, rain || 0.8)) : 0,
    wind: WEATHER_WIND[weather],
    night: INSECTS[tod],
  };
}
