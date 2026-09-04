import {
  distanceToPolylineMeters,
  haversineMeters,
  polylineLengthMeters,
} from "./geo";
import { resolveOpenState, type ClockNow } from "./openingHours";
import { categoryLabel, displayName, type OsmSnapshot } from "./overpass";
import type {
  LatLng,
  OsmPlace,
  RawRoute,
  RouteSafetyInputs,
  VerifiedSafeHaven,
} from "./types";

/**
 * Turns real OSM data + the verified Safe Haven network into measured inputs
 * for the Safety Engine. All corridor widths are explicit so the numbers shown
 * in the UI can be explained.
 */
export const CORRIDORS = {
  lightingMeters: 40,
  activityMeters: 60,
  crossingMeters: 30,
  pedestrianWayMeters: 25,
  safeHavenMeters: 350,
} as const;

function countWithinCorridor(
  points: Array<{ lat: number; lng: number }>,
  route: LatLng[],
  corridorMeters: number,
): number {
  return points.filter(
    (p) => distanceToPolylineMeters({ lat: p.lat, lng: p.lng }, route) <= corridorMeters,
  ).length;
}

/**
 * Metres of mapped pedestrian way running alongside the route. A segment
 * counts fully when both ends are inside the corridor, and half when only one
 * end is, which avoids over-crediting paths that merely cross the route.
 */
function pedestrianMetersAlongRoute(
  snapshot: OsmSnapshot,
  route: LatLng[],
): number {
  let total = 0;

  for (const way of snapshot.pedestrianWays) {
    for (let i = 1; i < way.geometry.length; i++) {
      const a = way.geometry[i - 1];
      const b = way.geometry[i];
      const aIn =
        distanceToPolylineMeters(a, route) <= CORRIDORS.pedestrianWayMeters;
      const bIn =
        distanceToPolylineMeters(b, route) <= CORRIDORS.pedestrianWayMeters;
      if (!aIn && !bIn) continue;
      const length = haversineMeters(a, b);
      total += aIn && bIn ? length : length / 2;
    }
  }

  // Mapped footways can zig-zag alongside a road, so cap at route length to
  // keep the derived coverage percentage meaningful.
  return Math.min(total, polylineLengthMeters(route));
}

function nearestEmergencyMeters(
  snapshot: OsmSnapshot,
  route: LatLng[],
): number {
  if (snapshot.emergencyFacilities.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return snapshot.emergencyFacilities.reduce(
    (best, facility) =>
      Math.min(best, distanceToPolylineMeters({ lat: facility.lat, lng: facility.lng }, route)),
    Number.POSITIVE_INFINITY,
  );
}

export function safeHavensNearRoute(
  route: LatLng[],
  havens: VerifiedSafeHaven[],
): VerifiedSafeHaven[] {
  return havens
    .map((haven) => ({
      ...haven,
      distanceFromRoute: Math.round(
        distanceToPolylineMeters({ lat: haven.latitude, lng: haven.longitude }, route),
      ),
    }))
    .filter(
      (haven) => (haven.distanceFromRoute ?? Infinity) <= CORRIDORS.safeHavenMeters,
    )
    .sort((a, b) => (a.distanceFromRoute ?? 0) - (b.distanceFromRoute ?? 0));
}

/**
 * Builds engine inputs for one route.
 *
 * `snapshot` is null when Overpass could not be reached -- every OSM-derived
 * indicator then becomes `null` ("unavailable"), never zero.
 *
 * `havens` is null when the Safe Haven network could not be read.
 */
export function buildRouteSafetyInputs(
  route: RawRoute,
  snapshot: OsmSnapshot | null,
  havens: VerifiedSafeHaven[] | null,
  now?: ClockNow,
): RouteSafetyInputs {
  const geometry = route.geometry.coordinates;
  const routeDistanceMeters = route.distance;

  if (!snapshot) {
    return {
      mappedLampsNearRoute: null,
      activityPoisNearRoute: null,
      establishmentsOpen: null,
      establishmentsClosed: null,
      establishmentsUnknown: null,
      pedestrianWayMeters: null,
      pedestrianCrossings: null,
      nearestEmergencyMeters: null,
      verifiedSafeHavensNearRoute: havens
        ? safeHavensNearRoute(geometry, havens)
        : null,
      routeDistanceMeters,
    };
  }

  // An area with zero mapped lamps anywhere in the queried box is almost
  // certainly unmapped rather than genuinely unlit, so we report "unavailable"
  // instead of implying darkness.
  const lightingMapped = snapshot.streetLamps.length > 0;
  const activityMapped = snapshot.activityPois.length > 0;
  const pedestrianMapped =
    snapshot.pedestrianWays.length > 0 || snapshot.crossings.length > 0;

  const nearbyPois = snapshot.activityPois.filter(
    (poi) =>
      distanceToPolylineMeters({ lat: poi.lat, lng: poi.lng }, geometry) <=
      CORRIDORS.activityMeters,
  );

  let open = 0;
  let closed = 0;
  let unknown = 0;
  for (const poi of nearbyPois) {
    const state = resolveOpenState(poi.tags.opening_hours, now);
    if (state === "open") open++;
    else if (state === "closed") closed++;
    else unknown++;
  }

  return {
    mappedLampsNearRoute: lightingMapped
      ? countWithinCorridor(snapshot.streetLamps, geometry, CORRIDORS.lightingMeters)
      : null,
    activityPoisNearRoute: activityMapped ? nearbyPois.length : null,
    establishmentsOpen: activityMapped ? open : null,
    establishmentsClosed: activityMapped ? closed : null,
    establishmentsUnknown: activityMapped ? unknown : null,
    pedestrianWayMeters: pedestrianMapped
      ? Math.round(pedestrianMetersAlongRoute(snapshot, geometry))
      : null,
    pedestrianCrossings: pedestrianMapped
      ? countWithinCorridor(snapshot.crossings, geometry, CORRIDORS.crossingMeters)
      : null,
    nearestEmergencyMeters: nearestEmergencyMeters(snapshot, geometry),
    verifiedSafeHavensNearRoute: havens
      ? safeHavensNearRoute(geometry, havens)
      : null,
    routeDistanceMeters,
  };
}

/**
 * OSM establishments near a route, for display on the map.
 * These are OpenStreetMap places -- explicitly NOT LOG POSE Safe Havens.
 */
export function osmPlacesNearRoute(
  snapshot: OsmSnapshot,
  route: LatLng[],
  now?: ClockNow,
  limit = 60,
): OsmPlace[] {
  const candidates = [...snapshot.activityPois, ...snapshot.emergencyFacilities];
  const seen = new Set<string>();

  return candidates
    .filter((poi) => {
      if (seen.has(poi.id)) return false;
      seen.add(poi.id);
      return true;
    })
    .map((poi) => ({
      poi,
      distance: distanceToPolylineMeters({ lat: poi.lat, lng: poi.lng }, route),
    }))
    .filter((entry) => entry.distance <= CORRIDORS.activityMeters * 2)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ poi, distance }) => ({
      id: poi.id,
      name: displayName(poi.tags),
      category: categoryLabel(poi.tags),
      latitude: poi.lat,
      longitude: poi.lng,
      openState: resolveOpenState(poi.tags.opening_hours, now),
      openingHoursRaw: poi.tags.opening_hours ?? null,
      distanceFromRoute: Math.round(distance),
      isEmergencyFacility: snapshot.emergencyFacilities.some((f) => f.id === poi.id),
    }));
}
