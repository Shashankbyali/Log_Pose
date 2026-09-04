import type { BoundingBox, LatLng } from "./types";

const EARTH_RADIUS_M = 6371000;

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Local equirectangular projection in metres, accurate enough at city scale. */
function project(point: LatLng, origin: LatLng): { x: number; y: number } {
  const x =
    toRadians(point.lng - origin.lng) *
    EARTH_RADIUS_M *
    Math.cos(toRadians(origin.lat));
  const y = toRadians(point.lat - origin.lat) * EARTH_RADIUS_M;
  return { x, y };
}

/** Perpendicular distance in metres from a point to a polyline. */
export function distanceToPolylineMeters(
  point: LatLng,
  polyline: LatLng[],
): number {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  if (polyline.length === 1) return haversineMeters(point, polyline[0]);

  const origin = polyline[0];
  const p = project(point, origin);
  let best = Number.POSITIVE_INFINITY;

  for (let i = 1; i < polyline.length; i++) {
    const a = project(polyline[i - 1], origin);
    const b = project(polyline[i], origin);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;

    let t = 0;
    if (lengthSq > 0) {
      t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));
    }

    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist < best) best = dist;
  }

  return best;
}

export function polylineLengthMeters(polyline: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < polyline.length; i++) {
    total += haversineMeters(polyline[i - 1], polyline[i]);
  }
  return total;
}

export function boundingBoxOf(
  points: LatLng[],
  paddingMeters = 0,
): BoundingBox {
  if (points.length === 0) {
    throw new Error("boundingBoxOf requires at least one point");
  }

  let south = points[0].lat;
  let north = points[0].lat;
  let west = points[0].lng;
  let east = points[0].lng;

  for (const point of points) {
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
  }

  if (paddingMeters > 0) {
    const latPad = (paddingMeters / EARTH_RADIUS_M) * (180 / Math.PI);
    const midLat = toRadians((south + north) / 2);
    const lngPad = latPad / Math.max(Math.cos(midLat), 0.01);
    south -= latPad;
    north += latPad;
    west -= lngPad;
    east += lngPad;
  }

  return { south, west, north, east };
}

/** Evenly spaced samples along a polyline, used for corridor sampling. */
export function samplePolyline(polyline: LatLng[], maxSamples = 24): LatLng[] {
  if (polyline.length <= maxSamples) return polyline;
  const step = (polyline.length - 1) / (maxSamples - 1);
  const samples: LatLng[] = [];
  for (let i = 0; i < maxSamples; i++) {
    samples.push(polyline[Math.round(i * step)]);
  }
  return samples;
}

/** Point at a given fraction along a polyline, by arc length. */
export function pointAtFraction(polyline: LatLng[], fraction: number): LatLng {
  if (polyline.length === 0) throw new Error("empty polyline");
  if (polyline.length === 1) return polyline[0];

  const target = polylineLengthMeters(polyline) * Math.min(1, Math.max(0, fraction));
  let travelled = 0;
  for (let i = 1; i < polyline.length; i++) {
    const seg = haversineMeters(polyline[i - 1], polyline[i]);
    if (travelled + seg >= target) return polyline[i];
    travelled += seg;
  }
  return polyline[polyline.length - 1];
}

/** Decodes an OSRM/Google encoded polyline (precision 5) into coordinates. */
export function decodePolyline(encoded: string): LatLng[] {
  const coordinates: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coordinates;
}

/**
 * Similarity between two route geometries, used to discard near-duplicate
 * OSRM results so we never present the same road twice as two "options".
 * Returns the fraction of sampled points of `a` lying within `toleranceMeters`
 * of `b`.
 */
export function geometryOverlap(
  a: LatLng[],
  b: LatLng[],
  toleranceMeters = 35,
): number {
  const samples = samplePolyline(a, 30);
  if (samples.length === 0) return 1;
  const near = samples.filter(
    (p) => distanceToPolylineMeters(p, b) <= toleranceMeters,
  ).length;
  return near / samples.length;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}
