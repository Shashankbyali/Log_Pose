import { NextResponse, type NextRequest } from "next/server";
import { boundingBoxOf } from "@/lib/geo";
import { nowInTimeZone } from "@/lib/openingHours";
import { fetchWalkingRoutes } from "@/lib/routing";
import { rankSafePlaces } from "@/lib/safePlaceRanking";
import { getVerifiedSafeHavens } from "@/lib/safeHavens";
import type { LatLng, SafePlaceOption } from "@/lib/types";

/**
 * "I need a safe place".
 *
 * Returns only physically verified LOG POSE Safe Havens near the user, ranked
 * by proximity, current availability and Trust Score. Real OSRM walking
 * distances are attached for the closest options.
 *
 * If the network has no verified Safe Havens nearby, that is reported honestly
 * -- OpenStreetMap businesses are never presented as Safe Havens.
 *
 * Privacy: the supplied location is used for this request only and is not
 * stored anywhere.
 */

export const maxDuration = 30;

const SEARCH_RADIUS_METERS = 2500;
/** Real walking routes are only requested for the top few options. */
const WALKING_ROUTE_LIMIT = 3;

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

  const network = await getVerifiedSafeHavens(
    boundingBoxOf([userLocation], SEARCH_RADIUS_METERS + 500),
    now,
  );

  if (network.havens === null) {
    return NextResponse.json(
      { error: network.warning ?? "Safe Haven network unavailable", options: [] },
      { status: 503 },
    );
  }

  const ranked = rankSafePlaces(userLocation, network.havens, SEARCH_RADIUS_METERS);

  // Attach genuine OSRM walking distance/duration for the highest-ranked
  // options. Failures leave the fields null rather than guessing.
  const withWalking: SafePlaceOption[] = await Promise.all(
    ranked.map(async (option, index) => {
      if (index >= WALKING_ROUTE_LIMIT) return option;
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

  return NextResponse.json({
    options: withWalking,
    searchRadiusMeters: SEARCH_RADIUS_METERS,
  });
}
