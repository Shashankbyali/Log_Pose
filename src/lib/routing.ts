import {
  decodePolyline,
  geometryOverlap,
  haversineMeters,
  toRadians,
} from "./geo";
import type {
  LatLng,
  RawRoute,
  RouteLabel,
  ScoredRoute,
  SafetyPreference,
} from "./types";

export { formatDistance, formatDuration } from "./geo";

/**
 * Real walking routes from OSRM.
 *
 * Every geometry returned by this module comes from an actual OSRM `foot`
 * response snapped to the OpenStreetMap walking network. Routes are never
 * synthesised, offset or interpolated. If OSRM cannot answer, this module
 * throws and the caller must surface the failure (or offer Demo Mode).
 */

/**
 * Default to the FOSSGIS / OpenStreetMap.de OSRM instance, which actually
 * hosts the `foot` profile. The public router.project-osrm.org demo server
 * only serves the car profile, so it would return driving durations for a
 * walking request -- an ETA we must not present as a walking time.
 */
const OSRM_BASE =
  process.env.NEXT_PUBLIC_OSRM_URL ?? "https://routing.openstreetmap.de/routed-foot";

const OSRM_TIMEOUT_MS = 12000;
const MAX_ROUTES = 3;
/** Extra OSRM requests allowed when the server returns no alternatives. */
const MAX_VIA_REQUESTS = 3;
/** A via route this much slower than the direct route is not a useful option. */
const MAX_VIA_DURATION_FACTOR = 2.2;
/** Two geometries overlapping more than this are the same road. */
const DUPLICATE_OVERLAP = 0.8;

export class RoutingError extends Error {}

interface OsrmRoute {
  geometry: string;
  distance: number;
  duration: number;
}

async function requestOsrm(waypoints: LatLng[], alternatives: boolean) {
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const params = new URLSearchParams({
    overview: "full",
    geometries: "polyline",
    steps: "false",
    alternatives: alternatives ? "3" : "false",
  });
  const url = `${OSRM_BASE}/route/v1/foot/${coords}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LogPose-SafetyNavigation/1.0 (hackathon prototype)",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    throw new RoutingError(
      error instanceof Error && error.name === "AbortError"
        ? "Walking routing timed out"
        : "Walking routing service unreachable",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new RoutingError(`Walking routing failed (${response.status})`);
  }

  const data = (await response.json()) as {
    code?: string;
    routes?: OsrmRoute[];
  };

  if (data.code && data.code !== "Ok") {
    throw new RoutingError(
      data.code === "NoRoute"
        ? "No walking route exists between these points"
        : `Walking routing failed (${data.code})`,
    );
  }

  return data.routes ?? [];
}

function toRawRoute(
  route: OsrmRoute,
  id: string,
  source: RawRoute["source"],
  sourceNote: string,
): RawRoute {
  return {
    id,
    geometry: { coordinates: decodePolyline(route.geometry) },
    distance: route.distance,
    duration: route.duration,
    source,
    sourceNote,
  };
}

function isDuplicate(candidate: RawRoute, existing: RawRoute[]): boolean {
  return existing.some(
    (route) =>
      geometryOverlap(
        candidate.geometry.coordinates,
        route.geometry.coordinates,
      ) >= DUPLICATE_OVERLAP,
  );
}

/**
 * Lateral probe points used only as OSRM waypoint hints. OSRM snaps each hint
 * to the nearest real walkable OSM way, so the returned route is entirely
 * real; the hint just makes the router explore a different real corridor.
 */
function buildProbePoints(origin: LatLng, destination: LatLng): LatLng[] {
  const directMeters = haversineMeters(origin, destination);
  const offsetMeters = Math.min(900, Math.max(250, directMeters * 0.25));

  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  const cosLat = Math.cos(toRadians((origin.lat + destination.lat) / 2));

  // Unit vector perpendicular to the origin-destination line, in degrees.
  const length = Math.hypot(dLat, dLng * cosLat) || 1;
  const perpLat = (-dLng * cosLat) / length;
  const perpLng = dLat / length / Math.max(cosLat, 0.01);

  const degreesPerMeter = 1 / 111320;
  const probes: LatLng[] = [];

  for (const fraction of [0.5, 0.35, 0.65]) {
    const baseLat = origin.lat + dLat * fraction;
    const baseLng = origin.lng + dLng * fraction;
    const sign = fraction === 0.35 ? -1 : 1;
    probes.push({
      lat: baseLat + perpLat * offsetMeters * degreesPerMeter * sign,
      lng: baseLng + perpLng * offsetMeters * degreesPerMeter * sign,
    });
  }

  return probes;
}

/**
 * Fetches up to three genuinely distinct real walking routes.
 *
 * `viaCandidates` (e.g. verified Safe Haven locations) are tried first as
 * waypoint hints, because routing past a Safe Haven is a meaningful option.
 */
export async function fetchWalkingRoutes(
  origin: LatLng,
  destination: LatLng,
  viaCandidates: LatLng[] = [],
): Promise<{ routes: RawRoute[]; warnings: string[] }> {
  const warnings: string[] = [];

  const direct = await requestOsrm([origin, destination], true);
  if (direct.length === 0) {
    throw new RoutingError("No walking route returned for this trip");
  }

  const routes: RawRoute[] = [];
  direct.forEach((route, index) => {
    const raw = toRawRoute(
      route,
      `osrm-${index}`,
      index === 0 ? "osrm-primary" : "osrm-alternative",
      index === 0
        ? "Direct OSRM walking route"
        : "OSRM alternative walking route",
    );
    if (!isDuplicate(raw, routes)) routes.push(raw);
  });

  const primary = routes[0];
  const hints = [...viaCandidates, ...buildProbePoints(origin, destination)];
  let requests = 0;

  for (const hint of hints) {
    if (routes.length >= MAX_ROUTES || requests >= MAX_VIA_REQUESTS) break;
    requests++;

    try {
      const viaRoutes = await requestOsrm([origin, hint, destination], false);
      const candidate = viaRoutes[0];
      if (!candidate) continue;
      if (candidate.duration > primary.duration * MAX_VIA_DURATION_FACTOR) continue;

      const raw = toRawRoute(
        candidate,
        `osrm-via-${requests}`,
        "osrm-via",
        "Real OSRM walking route via a nearby street",
      );
      if (!isDuplicate(raw, routes)) routes.push(raw);
    } catch {
      // A failed exploratory request is not fatal; we simply offer fewer options.
    }
  }

  if (routes.length === 1) {
    warnings.push(
      "Only one distinct walking route is available between these points, so route comparison is limited.",
    );
  }

  return { routes: routes.slice(0, MAX_ROUTES), warnings };
}

/**
 * Labels real routes by their measured trade-off. With fewer than three routes
 * the labels collapse honestly instead of inventing extra options.
 */
export function assignRouteLabels(routes: ScoredRoute[]): ScoredRoute[] {
  if (routes.length === 0) return routes;

  const scoreOf = (route: ScoredRoute) => route.safety.totalScore ?? -1;

  const fastest = [...routes].sort((a, b) => a.duration - b.duration)[0];
  const labels = new Map<string, RouteLabel>([[fastest.id, "fastest"]]);

  const others = routes.filter((route) => route.id !== fastest.id);

  // A route only earns the "safest" label if it genuinely scores higher than
  // the fastest one. Otherwise there is no safety gain to trade time for.
  const bestByScore = [...others].sort((a, b) => {
    const delta = scoreOf(b) - scoreOf(a);
    return delta !== 0 ? delta : a.duration - b.duration;
  })[0];

  if (bestByScore && scoreOf(bestByScore) > scoreOf(fastest)) {
    labels.set(bestByScore.id, "safest");

    const remaining = others.filter((route) => !labels.has(route.id));
    const balanced = [...remaining].sort(
      (a, b) => balancedUtility(b, fastest) - balancedUtility(a, fastest),
    )[0];
    if (balanced) labels.set(balanced.id, "balanced");
  }

  return routes.map((route) => ({
    ...route,
    label: labels.get(route.id) ?? "alternative",
  }));
}

/** True when no alternative improves on the fastest route's Safety Score. */
export function fastestIsAlsoSafest(routes: ScoredRoute[]): boolean {
  return routes.length > 1 && !routes.some((route) => route.label === "safest");
}

/** Safety gained per unit of extra walking time, relative to the fastest route. */
function balancedUtility(route: ScoredRoute, fastest: ScoredRoute): number {
  const score = route.safety.totalScore ?? 0;
  const timePenalty = (route.duration - fastest.duration) / 60;
  return score - timePenalty * 3;
}

export function getRecommendedRoute(
  routes: ScoredRoute[],
  preference: SafetyPreference,
): ScoredRoute | null {
  if (routes.length === 0) return null;

  const exact = routes.find((route) => route.label === preference);
  if (exact) return exact;

  if (preference === "fastest") {
    return [...routes].sort((a, b) => a.duration - b.duration)[0];
  }
  if (preference === "safest") {
    return [...routes].sort(
      (a, b) => (b.safety.totalScore ?? -1) - (a.safety.totalScore ?? -1),
    )[0];
  }

  const fastest = [...routes].sort((a, b) => a.duration - b.duration)[0];
  return [...routes].sort(
    (a, b) => balancedUtility(b, fastest) - balancedUtility(a, fastest),
  )[0];
}
