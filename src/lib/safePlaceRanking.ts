import { haversineMeters } from "./geo";
import type {
  LatLng,
  NearbyPlace,
  NearbyPlaceOption,
  SafePlaceOption,
  VerifiedSafeHaven,
} from "./types";

/**
 * Ranking for the "I need a safe place" flow. Pure and client-safe, so it can
 * run in the browser for Demo Mode without importing any server-side data
 * access.
 *
 * Open, closer and more trusted places rank higher. Closed ones are pushed
 * down rather than hidden, so the user always sees the real options available.
 */
export function rankSafePlaces(
  userLocation: LatLng,
  havens: VerifiedSafeHaven[],
  maxDistanceMeters = 2500,
): SafePlaceOption[] {
  return havens
    .map((haven) => {
      const distanceMeters = haversineMeters(userLocation, {
        lat: haven.latitude,
        lng: haven.longitude,
      });

      const proximity = Math.max(0, 100 - (distanceMeters / maxDistanceMeters) * 100);
      const availability =
        haven.openState === "open" ? 100 : haven.openState === "unknown" ? 45 : 10;

      const rankScore = Math.round(
        proximity * 0.4 + availability * 0.35 + haven.trustScore * 0.25,
      );

      return {
        ...haven,
        distanceMeters: Math.round(distanceMeters),
        walkingDistanceMeters: null,
        walkingDurationSeconds: null,
        rankScore,
      } satisfies SafePlaceOption;
    })
    .filter((option) => option.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => b.rankScore - a.rankScore);
}

/**
 * How likely an OpenStreetMap category is to be a staffed, indoor, publicly
 * enterable space that a pedestrian can walk into.
 *
 * This ranks CATEGORIES, not establishments. It is derived only from the OSM
 * tag and says nothing about whether a particular business is safe or willing
 * to help -- that is exactly what physical verification establishes, and none
 * of these places have it. Categories that are not listed are excluded rather
 * than given a guessed value.
 */
const CATEGORY_SUITABILITY: Record<string, number> = {
  police: 100,
  ambulance_station: 95,
  hospital: 95,
  fire_station: 95,
  pharmacy: 85,
  chemist: 85,
  fuel: 85,
  hotel: 85,
  clinic: 80,
  convenience: 75,
  supermarket: 75,
  doctors: 70,
  mall: 70,
  department_store: 70,
  cafe: 70,
  restaurant: 70,
  fast_food: 70,
  guest_house: 70,
  hostel: 70,
  motel: 70,
  bus_station: 65,
  library: 60,
  community_centre: 60,
  townhall: 60,
  bank: 55,
  place_of_worship: 55,
  cinema: 55,
  college: 50,
  university: 50,
  theatre: 50,
};

/** "Fast Food" -> "fast_food", so display labels and OSM tags agree. */
function normaliseCategory(category: string): string {
  return category.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function categorySuitability(category: string): number | null {
  return CATEGORY_SUITABILITY[normaliseCategory(category)] ?? null;
}

/**
 * Ranks unverified OpenStreetMap establishments as a fallback for the
 * "I need a safe place" flow. Pure and client-safe.
 *
 * These are always presented below verified Safe Havens and always carry the
 * "not LOG POSE verified" warning; ordering them here does not promote them.
 * Places whose OSM category is not a plausible walk-in space are dropped, and
 * places OSM says are closed right now are dropped too, because sending
 * someone to a shuttered door in an emergency is worse than showing nothing.
 *
 * The result is capped per category, because central Bengaluru maps far more
 * cafes than pharmacies and an undiversified list of eight coffee shops is
 * less useful than a mix that also surfaces a chemist or a fuel station.
 */
export function rankNearbyPlaces(
  userLocation: LatLng,
  places: NearbyPlace[],
  maxDistanceMeters = 1500,
  limit = 8,
  maxPerCategory = 2,
): NearbyPlaceOption[] {
  const ranked = places
    .flatMap((place) => {
      const suitability = categorySuitability(place.category);
      if (suitability === null) return [];
      if (place.openState === "closed") return [];

      const distanceMeters = haversineMeters(userLocation, {
        lat: place.latitude,
        lng: place.longitude,
      });
      if (distanceMeters > maxDistanceMeters) return [];

      // Squared falloff: when you need to get off the street, somewhere 30 m
      // away is worth far more than somewhere 600 m away, and a linear ramp
      // does not express that.
      const proximity = 100 * (1 - distanceMeters / maxDistanceMeters) ** 2;
      const availability = place.openState === "open" ? 100 : 50;

      return [
        {
          ...place,
          distanceMeters: Math.round(distanceMeters),
          walkingDistanceMeters: null,
          walkingDurationSeconds: null,
          rankScore: Math.round(
            proximity * 0.3 + availability * 0.3 + suitability * 0.4,
          ),
        } satisfies NearbyPlaceOption,
      ];
    })
    // Distance breaks ties, so the order is deterministic rather than
    // dependent on whatever order Overpass happened to return.
    .sort(
      (a, b) => b.rankScore - a.rankScore || a.distanceMeters - b.distanceMeters,
    );

  const perCategory = new Map<string, number>();
  const selected: NearbyPlaceOption[] = [];

  for (const option of ranked) {
    if (selected.length >= limit) break;
    const key = normaliseCategory(option.category);
    const used = perCategory.get(key) ?? 0;
    if (used >= maxPerCategory) continue;
    perCategory.set(key, used + 1);
    selected.push(option);
  }

  return selected;
}
