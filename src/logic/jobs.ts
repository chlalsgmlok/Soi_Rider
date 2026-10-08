import type { Rng } from '../core/rng';
import type { CityData, JobOffer, POI, PassengerTrait, TrafficIntensity } from '../core/types';
import { fareFor } from './earnings';
import { bandsForReach, DISTANCE_BAND_ORDER, estimateMeters, reachFrom, type DistanceBand } from './job-distances';
import { noteFor } from './job-notes';
import { chooseDrops, choosePickups, round10, tripMeters } from './job-places';
import { rollPassenger } from './passengers';

/** The three gram offers of a trip (docs/GAME_DESIGN.md §2 Intro, §8, §11). Pure and deterministic for a given rng. */

const TRAITS: readonly PassengerTrait[] = ['hurry', 'nervous', 'tourist', 'shopper', 'regular'];

/** where passengers wait / want to go: not the rider's own stand and not another win stand (unless the map has nothing else) */
function servicePois(city: CityData): POI[] {
  const notSpawn = city.pois.filter((p) => p.id !== city.spawn.poi);
  const service = notSpawn.filter((p) => p.kind !== 'win_stand');
  if (service.length >= 2) return service;
  return notSpawn.length >= 2 ? notSpawn : city.pois;
}

function rollTraits(rng: Rng, tripNumber: number): PassengerTrait[] {
  const traits = rng.shuffle([...TRAITS]).slice(0, 3);
  /* the first trip always has an easy-going regular from Lek's stall among the offers */
  if (tripNumber <= 1 && !traits.includes('regular')) traits[rng.int(0, 2)] = 'regular';
  return traits;
}

/**
 * Gives `long` to the pickup that can reach farthest and `short` to the one that reaches least, so on a compact map
 * each offer gets a band its pickup can actually serve (ties keep offer order).
 */
function assignBands(reaches: readonly number[]): DistanceBand[] {
  const order = reaches.map((_, i) => i).sort((a, b) => reaches[a] - reaches[b] || a - b);
  const out: DistanceBand[] = [];
  order.forEach((offer, rank) => {
    out[offer] = DISTANCE_BAND_ORDER[rank];
  });
  return out;
}

/**
 * Three offers sorted short → long: distinct traits, pickups and passengers, drops preferably distinct and trip lengths
 * at least MIN_OFFER_GAP apart whenever the map allows. Distance bands follow DISTANCE_BANDS on a large map and are
 * compressed to the city's reach on a compact one (job-distances.ts).
 */
export function generateOffers(city: CityData, rng: Rng, intensity: TrafficIntensity, tripNumber: number): JobOffer[] {
  const pois = servicePois(city);
  if (pois.length < 2) throw new Error(`generateOffers: city ${city.seed} needs at least 2 POIs (has ${pois.length})`);

  const passengerRng = rng.fork('passengers');
  const noteRng = rng.fork('notes');
  const traits = rollTraits(rng, tripNumber);
  const spawn = city.spawn.pos;
  const pickups = choosePickups(rng, pois, spawn, traits);
  const reaches = pickups.map((p) => reachFrom(p, pois));
  const bands = assignBands(reaches);
  const drops = chooseDrops(rng, { pois, pickups, traits, bands, ranges: bandsForReach(Math.max(...reaches)) });
  const usedNames = new Set<string>();

  const offers = traits.map((trait, i): JobOffer => {
    const pickup = pickups[i];
    const drop = drops[i];
    const estMeters = tripMeters(pickup, drop);
    return {
      id: `trip${tripNumber}-job${i + 1}-${pickup.id}-${drop.id}`,
      passenger: rollPassenger(passengerRng, trait, usedNames, `trip${tripNumber}-p${i + 1}`),
      pickupPoi: pickup.id,
      dropPoi: drop.id,
      estMeters,
      approachMeters: round10(estimateMeters(spawn, pickup.pos)),
      fareBaht: fareFor(estMeters, intensity),
      note: noteFor(noteRng, trait, drop.kind),
    };
  });
  return offers.sort((a, b) => a.estMeters - b.estMeters);
}