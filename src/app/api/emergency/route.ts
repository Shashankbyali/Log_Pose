import { NextResponse, type NextRequest } from "next/server";
import { haversineMeters } from "@/lib/geo";
import { nowInTimeZone, resolveOpenState } from "@/lib/openingHours";
import {
  addressOf,
  categoryLabel,
  describeOverpassFailure,
  displayName,
  emergencyFacilityType,
  fetchNearbyShelterCandidates,
  fetchNearestPoliceStation,
  phoneOf,
} from "@/lib/overpass";
import { fetchWalkingRoutes } from "@/lib/routing";
import { rankNearbyPlaces } from "@/lib/safePlaceRanking";
import type { EmergencySearchResult, LatLng, NearbyPlace } from "@/lib/types";

export const maxDuration = 30;

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

async function walkingTo(origin: LatLng, destination: LatLng) {
  try {
    const best = (await fetchWalkingRoutes(origin, destination)).routes[0];
    return best
      ? { distance: Math.round(best.distance), duration: Math.round(best.duration) }
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const location = (body as { location?: unknown }).location;
  if (!isLatLng(location)) {
    return NextResponse.json({ error: "A valid current location is required" }, { status: 400 });
  }

  const now = nowInTimeZone();
  const [police, facilities] = await Promise.all([
    fetchNearestPoliceStation(location, 8000).catch(() => null),
    fetchNearbyShelterCandidates(location, 3000).catch(() => []),
  ]);

  const official = facilities
    .map((point): NearbyPlace | null => {
      const type = emergencyFacilityType(point.tags);
      if (!type) return null;
      return {
        id: point.id,
        name: displayName(point.tags),
        category: categoryLabel(point.tags),
        latitude: point.lat,
        longitude: point.lng,
        openState: resolveOpenState(point.tags.opening_hours, now),
        openingHoursRaw: point.tags.opening_hours ?? null,
        address: addressOf(point.tags),
        phone: phoneOf(point.tags),
        isEmergencyFacility: true,
        officialFacilityType: type,
      };
    })
    .filter((place): place is NearbyPlace => place !== null);

  const ranked = rankNearbyPlaces(location, official, 3000, 8, 3);
  const withWalking = await Promise.all(
    ranked.map(async (place) => {
      const route = await walkingTo(location, {
        lat: place.latitude,
        lng: place.longitude,
      });
      return {
        ...place,
        walkingDistanceMeters: route?.distance ?? null,
        walkingDurationSeconds: route?.duration ?? null,
      };
    }),
  );

  const policeWalking = police
    ? await walkingTo(location, { lat: police.lat, lng: police.lng })
    : null;

  const payload: EmergencySearchResult = {
    location,
    police: police
      ? {
          ...police,
          distanceMeters: Math.round(
            haversineMeters(location, { lat: police.lat, lng: police.lng }),
          ),
          walkingDistanceMeters: policeWalking?.distance ?? null,
          walkingDurationSeconds: policeWalking?.duration ?? null,
          address: null,
        }
      : null,
    facilities: withWalking,
    warning: police || withWalking.length > 0 ? null : describeOverpassFailure("unavailable"),
  };

  return NextResponse.json(payload);
}