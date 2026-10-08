import { STARTER_LOADOUT } from '../../core/config/catalog';
import { Rng } from '../../core/rng';
import type {
  BikeModelId, CityData, JobOffer, PassengerTrait, RunConfig, TimeOfDay, TrafficIntensity, WeatherEvent, WeatherPlan,
} from '../../core/types';
import { generateOffers } from '../../logic/jobs';
import { rollPassenger } from '../../logic/passengers';

const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const INTENSITIES: readonly TrafficIntensity[] = ['light', 'rush', 'gridlock'];
const TRAITS: readonly PassengerTrait[] = ['hurry', 'nervous', 'tourist', 'shopper', 'regular'];
const BIKES: readonly BikeModelId[] = ['cub', 'scooter', 'sport'];

const pick = <T extends string>(list: readonly T[], v: string | null, d: T): T => list.find((x) => x === v) ?? d;

/**
 * Dev-only run setup for sandbox/mission.html from URL params: the real gram offers of the generated city
 * (`job=0..2`, short → long), an optional passenger trait override and a weather plan with an early downpour
 * (`storm=1`) and/or haze spike (`smog=1`) so the story prompts show up on a short trip.
 */
export function sandboxRun(data: CityData, qs: URLSearchParams): { config: RunConfig; job: JobOffer } {
  const seed = data.seed;
  const intensity = pick(INTENSITIES, qs.get('intensity'), 'rush');
  const events: WeatherEvent[] = [];
  if (qs.get('storm') === '1') events.push({ kind: 'downpour', atProgress: Number(qs.get('stormAt') ?? 0.2), duration: 70, intensity: 0.9 });
  if (qs.get('smog') === '1') events.push({ kind: 'haze_spike', atProgress: Number(qs.get('smogAt') ?? 0.1), duration: 40, intensity: 0.8 });
  const base = (['clear', 'haze', 'overcast'] as const).find((b) => b === qs.get('weather')) ?? 'clear';
  const weather: WeatherPlan = { base, haze: base === 'haze' ? 0.45 : 0.08, events };
  const config: RunConfig = {
    seed, tripNumber: Number(qs.get('trip') ?? 3), intensity, timeOfDay: pick(TODS, qs.get('tod'), 'sunset'), weather,
    district: data.district, loadout: { ...STARTER_LOADOUT, bike: pick(BIKES, qs.get('bike'), 'cub') },
  };
  const offers = generateOffers(data, new Rng(seed).fork('offers'), intensity, config.tripNumber);
  const offer = offers[Math.min(offers.length - 1, Math.max(0, Number(qs.get('job') ?? 0)))];
  const trait = TRAITS.find((t) => t === qs.get('trait'));
  const job = trait && trait !== offer.passenger.trait
    ? { ...offer, passenger: rollPassenger(new Rng(seed).fork('trait'), trait, new Set(), 'sandbox') }
    : offer;
  return { config, job };
}
