import { haversineMeters } from "./geo";
import type { LatLng, SafePlaceOption, VerifiedSafeHaven } from "./types";

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
