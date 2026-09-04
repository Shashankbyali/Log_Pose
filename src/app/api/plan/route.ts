import { NextResponse, type NextRequest } from "next/server";
import { SERVICE_AREA } from "@/lib/constants";
import { boundingBoxOf } from "@/lib/geo";
import { nowInTimeZone } from "@/lib/openingHours";
import { fetchOsmSnapshot, type OsmSnapshot } from "@/lib/overpass";
import {
  assignRouteLabels,
  fastestIsAlsoSafest,
  fetchWalkingRoutes,
  RoutingError,
} from "@/lib/routing";
import { getVerifiedSafeHavens } from "@/lib/safeHavens";
import { calculateSafetyScore } from "@/lib/safetyEngine";
import {
  buildRouteSafetyInputs,
  osmPlacesNearRoute,
  safeHavensNearRoute,
} from "@/lib/safetyInputs";
import type {
  LatLng,
  PlanResult,
  ScoredRoute,
  VerifiedSafeHaven,
} from "@/lib/types";

/**
 * LIVE MODE route planning pipeline.
 *
 *   real OSRM walking routes
 *     -> one Overpass query over the corridor of all candidate routes
 *     -> verified LOG POSE Safe Havens from Supabase
 *     -> deterministic Safety Engine
 *
 * Any data source that fails is reported in `warnings` and its indicators are
 * marked unavailable. Nothing is ever fabricated to fill a gap, and Demo Mode
 * data is never mixed in here.
 */

export const maxDuration = 60;

function withinServiceArea(point: LatLng): boolean {
  return (
    point.lat >= SERVICE_AREA.south &&
    point.lat <= SERVICE_AREA.north &&
    point.lng >= SERVICE_AREA.west &&
    point.lng <= SERVICE_AREA.east
  );
}

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.lat === "number" &&
    typeof candidate.lng === "number" &&
    Number.isFinite(candidate.lat) &&
    Number.isFinite(candidate.lng)
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { origin, destination } = (body ?? {}) as Record<string, unknown>;

  if (!isLatLng(origin) || !isLatLng(destination)) {
    return NextResponse.json(
      { error: "A valid origin and destination are required" },
      { status: 400 },
    );
  }

  const warnings: string[] = [];
  if (!withinServiceArea(origin) || !withinServiceArea(destination)) {
    warnings.push(
      "This trip is outside the Bengaluru live-data area. Safety indicators may be sparse.",
    );
  }

  const now = nowInTimeZone();

  // Safe Havens are fetched first so verified locations can be offered to OSRM
  // as real waypoint hints when looking for distinct route options.
  const cityNetwork = await getVerifiedSafeHavens(
    boundingBoxOf([origin, destination], 2000),
    now,
  );
  if (cityNetwork.warning) warnings.push(cityNetwork.warning);

  const viaCandidates = (cityNetwork.havens ?? [])
    .slice(0, 2)
    .map((haven) => ({ lat: haven.latitude, lng: haven.longitude }));

  let routes;
  try {
    const result = await fetchWalkingRoutes(origin, destination, viaCandidates);
    routes = result.routes;
    warnings.push(...result.warnings);
  } catch (error) {
    const message =
      error instanceof RoutingError
        ? error.message
        : "Walking routing is unavailable right now";
    return NextResponse.json({ error: message, canUseDemo: true }, { status: 503 });
  }

  const allPoints = routes.flatMap((route) => route.geometry.coordinates);

  let snapshot: OsmSnapshot | null = null;
  try {
    snapshot = await fetchOsmSnapshot(allPoints);
  } catch {
    warnings.push(
      "OpenStreetMap data (Overpass) is unavailable, so lighting, activity, open-establishment, accessibility and emergency indicators could not be measured for this trip.",
    );
  }

  // Restrict the network to Safe Havens actually near the candidate routes.
  const havensForScoring: VerifiedSafeHaven[] | null = cityNetwork.havens;

  const scored: ScoredRoute[] = routes.map((route) => {
    const inputs = buildRouteSafetyInputs(route, snapshot, havensForScoring, now);
    return {
      ...route,
      safety: calculateSafetyScore(inputs),
      label: "balanced" as const,
    };
  });

  const labelled = assignRouteLabels(scored);

  if (fastestIsAlsoSafest(labelled)) {
    warnings.push(
      "The fastest route also has the highest Safety Score for this trip, so there is no safety gain to trade travel time for.",
    );
  }

  const osmPlaces = snapshot
    ? osmPlacesNearRoute(
        snapshot,
        labelled.flatMap((route) => route.geometry.coordinates),
        now,
      )
    : [];

  // Verified Safe Havens within the corridor of any candidate route, keeping
  // the shortest measured distance for each one.
  const nearbyHavens = new Map<string, VerifiedSafeHaven>();
  for (const route of labelled) {
    for (const haven of safeHavensNearRoute(
      route.geometry.coordinates,
      havensForScoring ?? [],
    )) {
      const existing = nearbyHavens.get(haven.id);
      if (
        !existing ||
        (haven.distanceFromRoute ?? Infinity) < (existing.distanceFromRoute ?? Infinity)
      ) {
        nearbyHavens.set(haven.id, haven);
      }
    }
  }

  const payload: PlanResult = {
    mode: "live",
    routes: labelled,
    osmPlaces,
    safeHavens: [...nearbyHavens.values()].sort(
      (a, b) => (a.distanceFromRoute ?? 0) - (b.distanceFromRoute ?? 0),
    ),
    warnings,
  };

  return NextResponse.json(payload);
}
