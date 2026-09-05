import { boundingBoxOf } from "./geo";
import type { BoundingBox, LatLng } from "./types";

/**
 * Server-side OpenStreetMap data access via the Overpass API.
 *
 * Everything returned here is real mapped OSM data. When Overpass is
 * unavailable this module throws, and callers must surface the gap as
 * "data unavailable" rather than substituting invented values.
 */

const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
].filter((value): value is string => Boolean(value));

const OVERPASS_TIMEOUT_MS = 22000;

/** Amenity values that generate pedestrian activity. */
const ACTIVITY_AMENITIES = [
  "cafe",
  "restaurant",
  "fast_food",
  "bar",
  "pub",
  "ice_cream",
  "food_court",
  "pharmacy",
  "hospital",
  "clinic",
  "doctors",
  "dentist",
  "fuel",
  "bank",
  "atm",
  "marketplace",
  "bus_station",
  "college",
  "university",
  "school",
  "police",
  "fire_station",
  "library",
  "cinema",
  "theatre",
  "community_centre",
  "place_of_worship",
  "car_wash",
  "parking",
];

const EMERGENCY_AMENITIES = new Set([
  "hospital",
  "clinic",
  "doctors",
  "police",
  "fire_station",
]);

const PEDESTRIAN_HIGHWAYS = ["footway", "pedestrian", "path", "steps", "living_street"];

export interface OverpassPoint {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

export interface OverpassWay {
  id: string;
  geometry: LatLng[];
  tags: Record<string, string>;
}

export interface OsmSnapshot {
  streetLamps: OverpassPoint[];
  activityPois: OverpassPoint[];
  emergencyFacilities: OverpassPoint[];
  crossings: OverpassPoint[];
  pedestrianWays: OverpassWay[];
  bbox: BoundingBox;
}

interface RawElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

function buildQuery(bbox: BoundingBox): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const amenityRegex = ACTIVITY_AMENITIES.join("|");
  const pedestrianRegex = PEDESTRIAN_HIGHWAYS.join("|");

  return `[out:json][timeout:20];
(
  node["highway"="street_lamp"](${box});
  node["highway"="crossing"](${box});
  nwr["amenity"~"^(${amenityRegex})$"](${box});
  nwr["shop"](${box});
  nwr["tourism"~"^(hotel|guest_house|hostel|motel)$"](${box});
  nwr["healthcare"](${box});
  nwr["emergency"="ambulance_station"](${box});
)->.points;
.points out tags center 3000;
(
  way["highway"~"^(${pedestrianRegex})$"](${box});
  way["sidewalk"~"^(both|left|right|yes)$"](${box});
  way["foot"="designated"](${box});
)->.paths;
.paths out tags geom 1500;`;
}

async function runOverpassQuery(
  query: string,
  timeoutMs = OVERPASS_TIMEOUT_MS,
): Promise<RawElement[]> {
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "LogPose-SafetyNavigation/1.0 (hackathon prototype)",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
        cache: "no-store",
      }).finally(() => clearTimeout(timer));

      if (!response.ok) {
        lastError = new Error(`Overpass ${endpoint} responded ${response.status}`);
        continue;
      }

      const data = (await response.json()) as { elements?: RawElement[] };
      return data.elements ?? [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Overpass endpoints failed");
}

function pointOf(element: RawElement): OverpassPoint | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  return {
    id: `${element.type}/${element.id}`,
    lat,
    lng: lon,
    tags: element.tags ?? {},
  };
}

function isActivityPoi(tags: Record<string, string>): boolean {
  if (tags.shop) return true;
  if (tags.healthcare) return true;
  if (tags.tourism) return true;
  if (tags.amenity && ACTIVITY_AMENITIES.includes(tags.amenity)) return true;
  return false;
}

export function isEmergencyFacility(tags: Record<string, string>): boolean {
  if (tags.amenity && EMERGENCY_AMENITIES.has(tags.amenity)) return true;
  if (tags.emergency === "ambulance_station") return true;
  if (tags.healthcare === "hospital" || tags.healthcare === "emergency") return true;
  return false;
}

/**
 * Fetches mapped OSM safety infrastructure inside a bounding box built around
 * the supplied points (typically every coordinate of every candidate route).
 */
export async function fetchOsmSnapshot(
  points: LatLng[],
  paddingMeters = 180,
): Promise<OsmSnapshot> {
  const bbox = boundingBoxOf(points, paddingMeters);
  const elements = await runOverpassQuery(buildQuery(bbox));

  const snapshot: OsmSnapshot = {
    streetLamps: [],
    activityPois: [],
    emergencyFacilities: [],
    crossings: [],
    pedestrianWays: [],
    bbox,
  };

  for (const element of elements) {
    const tags = element.tags ?? {};

    if (element.type === "way" && element.geometry?.length) {
      const isPedestrian =
        (tags.highway && PEDESTRIAN_HIGHWAYS.includes(tags.highway)) ||
        ["both", "left", "right", "yes"].includes(tags.sidewalk ?? "") ||
        tags.foot === "designated";

      if (isPedestrian) {
        snapshot.pedestrianWays.push({
          id: `way/${element.id}`,
          geometry: element.geometry.map((g) => ({ lat: g.lat, lng: g.lon })),
          tags,
        });
        continue;
      }
    }

    const point = pointOf(element);
    if (!point) continue;

    if (tags.highway === "street_lamp") {
      snapshot.streetLamps.push(point);
      continue;
    }
    if (tags.highway === "crossing") {
      snapshot.crossings.push(point);
      continue;
    }
    if (isEmergencyFacility(tags)) {
      snapshot.emergencyFacilities.push(point);
    }
    if (isActivityPoi(tags)) {
      snapshot.activityPois.push(point);
    }
  }

  return snapshot;
}

/**
 * Amenity/shop/tourism values that are plausible places to head towards when a
 * pedestrian needs to get off the street: staffed, indoors and publicly
 * enterable. This is a filter on OSM categories only -- it is NOT a safety
 * judgement about the individual establishment, which is exactly why these are
 * never presented as verified LOG POSE Safe Havens.
 */
const SHELTER_AMENITIES = [
  "police",
  "fire_station",
  "hospital",
  "clinic",
  "doctors",
  "pharmacy",
  "fuel",
  "bank",
  "bus_station",
  "cafe",
  "restaurant",
  "fast_food",
  "library",
  "community_centre",
  "townhall",
  "place_of_worship",
  "cinema",
  "theatre",
  "college",
  "university",
];

const SHELTER_SHOPS = [
  "convenience",
  "supermarket",
  "mall",
  "department_store",
  "chemist",
];

/**
 * Tighter than the trip query. Someone tapping "I need a safe place" is
 * waiting on this, so a slow mirror is skipped quickly rather than holding up
 * the verified Safe Haven results that are already in hand.
 */
const OVERPASS_URGENT_TIMEOUT_MS = 9000;

function buildAroundQuery(center: LatLng, radiusMeters: number): string {
  const around = `around:${Math.round(radiusMeters)},${center.lat},${center.lng}`;
  const amenityRegex = SHELTER_AMENITIES.join("|");
  const shopRegex = SHELTER_SHOPS.join("|");

  return `[out:json][timeout:10];
(
  nwr["amenity"~"^(${amenityRegex})$"](${around});
  nwr["shop"~"^(${shopRegex})$"](${around});
  nwr["tourism"~"^(hotel|guest_house|hostel|motel)$"](${around});
  nwr["healthcare"](${around});
  nwr["emergency"="ambulance_station"](${around});
);
out tags center 300;`;
}

/**
 * Publicly enterable OSM establishments within `radiusMeters` of a point, used
 * as the unverified fallback for "I need a safe place" when the verified Safe
 * Haven network has nothing nearby.
 *
 * Throws when Overpass is unreachable; callers must report that as unavailable
 * rather than inventing places.
 */
export async function fetchNearbyShelterCandidates(
  center: LatLng,
  radiusMeters: number,
): Promise<OverpassPoint[]> {
  const elements = await runOverpassQuery(
    buildAroundQuery(center, radiusMeters),
    OVERPASS_URGENT_TIMEOUT_MS,
  );
  const points: OverpassPoint[] = [];

  for (const element of elements) {
    const point = pointOf(element);
    if (point) points.push(point);
  }

  return points;
}

/** Readable category label from OSM tags, used for map popups. */
export function categoryLabel(tags: Record<string, string>): string {
  const raw =
    tags.amenity ??
    tags.shop ??
    tags.tourism ??
    tags.healthcare ??
    tags.emergency ??
    "place";
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function displayName(tags: Record<string, string>): string {
  return tags.name ?? tags["name:en"] ?? categoryLabel(tags);
}
