import { NextResponse, type NextRequest } from "next/server";
import { fetchNearestPoliceStation } from "@/lib/overpass";
import { fetchWalkingRoutes } from "@/lib/routing";
import { startSafeWalk } from "@/lib/safeWalks";
import type {
  LatLng,
  PoliceStationSnapshot,
  SafeWalkDestinationKind,
} from "@/lib/types";

/**
 * Starts a Safe Walk: records a server-side arrival deadline for someone
 * heading to a safe place.
 *
 * The deadline is stored in the database rather than in a browser timer,
 * because a closed tab or a sleeping phone would otherwise silently cancel
 * the only safety mechanism the user is relying on.
 *
 * The expected duration is a real OSRM walking estimate, never a guess. If
 * routing fails, the walk is refused rather than started against a made-up
 * deadline that would fire at the wrong time.
 *
 * Privacy: no name, phone or account is stored. The response returns a
 * one-time device token that is the only way to confirm arrival.
 */

export const maxDuration = 30;

const MIN_GRACE_SECONDS = 120;
const MAX_GRACE_SECONDS = 3600;
/** Nothing sensible can be walked to beyond this, so refuse rather than guess. */
const MAX_WALK_SECONDS = 7200;

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

  const {
    origin,
    destination,
    destinationName,
    destinationKind,
    safeHavenId,
    graceSeconds,
  } = (body ?? {}) as Record<string, unknown>;

  if (!isLatLng(origin) || !isLatLng(destination)) {
    return NextResponse.json(
      { error: "A valid origin and destination are required" },
      { status: 400 },
    );
  }

  if (typeof destinationName !== "string" || destinationName.trim().length === 0) {
    return NextResponse.json(
      { error: "A destination name is required" },
      { status: 400 },
    );
  }

  if (destinationKind !== "verified_haven" && destinationKind !== "osm_place") {
    return NextResponse.json(
      { error: "An accurate destination kind is required" },
      { status: 400 },
    );
  }

  const grace = Math.min(
    MAX_GRACE_SECONDS,
    Math.max(MIN_GRACE_SECONDS, Math.round(Number(graceSeconds) || 600)),
  );

  // A real walking estimate, or no Safe Walk at all.
  let expectedWalkSeconds: number;
  try {
    const { routes } = await fetchWalkingRoutes(origin, destination);
    const best = routes[0];
    if (!best) throw new Error("no route");
    expectedWalkSeconds = Math.round(best.duration);
  } catch {
    return NextResponse.json(
      {
        error:
          "A real walking time could not be measured for this trip, so no arrival deadline can be set. Nothing is being watched.",
      },
      { status: 503 },
    );
  }

  if (expectedWalkSeconds > MAX_WALK_SECONDS) {
    return NextResponse.json(
      { error: "That destination is too far for a Safe Walk." },
      { status: 400 },
    );
  }

  // Captured now so escalation does not depend on Overpass being up later.
  // Null simply means none is mapped nearby; it is never filled in with a
  // placeholder.
  let police: PoliceStationSnapshot | null = null;
  try {
    const nearest = await fetchNearestPoliceStation(origin);
    if (nearest) {
      police = {
        name: nearest.name,
        lat: nearest.lat,
        lng: nearest.lng,
        phone: nearest.phone,
      };
    }
  } catch {
    police = null;
  }

  const { result, error } = await startSafeWalk({
    origin,
    destination,
    destinationName: destinationName.trim().slice(0, 200),
    destinationKind: destinationKind as SafeWalkDestinationKind,
    safeHavenId: typeof safeHavenId === "string" ? safeHavenId : null,
    expectedWalkSeconds,
    graceSeconds: grace,
    police,
  });

  if (!result) {
    return NextResponse.json(
      { error: error ?? "The Safe Walk could not be started." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    walk: result.walk,
    deviceToken: result.deviceToken,
  });
}
