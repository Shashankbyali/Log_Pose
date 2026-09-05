import { NextResponse, type NextRequest } from "next/server";
import { boundingBoxOf } from "@/lib/geo";
import { nowInTimeZone, resolveOpenState } from "@/lib/openingHours";
import {
  categoryLabel,
  displayName,
  fetchNearbyShelterCandidates,
  isEmergencyFacility,
} from "@/lib/overpass";
import { fetchWalkingRoutes } from "@/lib/routing";
import { rankNearbyPlaces, rankSafePlaces } from "@/lib/safePlaceRanking";
import { getVerifiedSafeHavens } from "@/lib/safeHavens";
import type {
  LatLng,
  NearbyPlace,
  NearbyPlaceOption,
  SafePlaceOption,
  SafePlaceSearchResult,
} from "@/lib/types";

/**
 * "I need a safe place".
 *
 * Returns two clearly separated groups:
 *
 *   1. Physically verified LOG POSE Safe Havens, ranked by proximity, current
 *      availability and Trust Score. These are always the priority.
 *   2. Unverified OpenStreetMap establishments nearby, as a fallback for the
 *      very real case where the verified network has no coverage yet.
 *
 * Group 2 is never described as a Safe Haven and never carries a Trust Score.
 * The two groups are returned separately so the UI cannot blend them, and each
 * has its own warning field so an outage in one source does not silently look
 * like "nothing found" in the other.
 *
 * Privacy: the supplied location is used for this request only and is not
 * stored anywhere.
 */

export const maxDuration = 45;

const VERIFIED_RADIUS_METERS = 2500;
/** Tighter, because an unverified fallback is only useful if it is close. */
const NEARBY_RADIUS_METERS = 1200;
/** Real walking routes are only requested for the few options shown first. */
const WALKING_ROUTE_LIMIT = 3;
/**
 * Hard ceiling on the OpenStreetMap fallback lookup. Someone is waiting on
 * this screen, so a slow Overpass mirror is abandoned and reported as
 * unavailable rather than making them stare at a spinner.
 */
const NEARBY_BUDGET_MS = 14000;

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

type Located = { latitude: number; longitude: number };

/**
 * Attaches genuine OSRM walking distance/duration to the top options.
 * Failures leave the fields null rather than guessing.
 */
async function withWalkingRoutes<T extends Located>(
  userLocation: LatLng,
  options: T[],
  limit: number,
): Promise<T[]> {
  return Promise.all(
    options.map(async (option, index) => {
      if (index >= limit) return option;
      try {
        const { routes } = await fetchWalkingRoutes(userLocation, {
          lat: option.latitude,
          lng: option.longitude,
        });
        const best = routes[0];
        if (!best) return option;
        return {
          ...option,
          walkingDistanceMeters: Math.round(best.distance),
          walkingDurationSeconds: Math.round(best.duration),
        };
      } catch {
        return option;
      }
    }),
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const location = (body as { location?: unknown }).location;
  if (
    !location ||
    typeof location !== "object" ||
    typeof (location as LatLng).lat !== "number" ||
    typeof (location as LatLng).lng !== "number"
  ) {
    return NextResponse.json({ error: "A valid location is required" }, { status: 400 });
  }

  const userLocation = location as LatLng;
  const now = nowInTimeZone();

  // Both sources are queried together: the unverified fallback is useful even
  // when the verified network responds, because it may simply be empty here.
  const [network, osmCandidates] = await Promise.all([
    getVerifiedSafeHavens(
      boundingBoxOf([userLocation], VERIFIED_RADIUS_METERS + 500),
      now,
    ),
    withDeadline(
      fetchNearbyShelterCandidates(userLocation, NEARBY_RADIUS_METERS),
      NEARBY_BUDGET_MS,
    ),
  ]);

  let verified: SafePlaceOption[] | null = null;
  if (network.havens !== null) {
    verified = rankSafePlaces(userLocation, network.havens, VERIFIED_RADIUS_METERS);
  }

  let nearby: NearbyPlaceOption[] | null = null;
  if (osmCandidates !== null) {
    const places: NearbyPlace[] = osmCandidates.map((point) => ({
      id: point.id,
      name: displayName(point.tags),
      category: categoryLabel(point.tags),
      latitude: point.lat,
      longitude: point.lng,
      openState: resolveOpenState(point.tags.opening_hours, now),
      openingHoursRaw: point.tags.opening_hours ?? null,
      isEmergencyFacility: isEmergencyFacility(point.tags),
    }));
    nearby = rankNearbyPlaces(userLocation, places, NEARBY_RADIUS_METERS);
  }

  // Walking routes are the slow part, so the budget goes to whichever group
  // the user will actually see first.
  const verifiedWithWalking = verified
    ? await withWalkingRoutes(userLocation, verified, WALKING_ROUTE_LIMIT)
    : null;

  const nearbyBudget = Math.max(
    0,
    WALKING_ROUTE_LIMIT - (verifiedWithWalking?.length ?? 0),
  );
  const nearbyWithWalking = nearby
    ? await withWalkingRoutes(userLocation, nearby, nearbyBudget)
    : null;

  const payload: SafePlaceSearchResult = {
    verified: verifiedWithWalking,
    verifiedWarning: network.havens === null ? network.warning : null,
    nearby: nearbyWithWalking,
    nearbyWarning:
      osmCandidates === null
        ? "OpenStreetMap did not respond in time, so nearby establishments could not be listed."
        : null,
    searchRadiusMeters: VERIFIED_RADIUS_METERS,
  };

  return NextResponse.json(payload);
}
