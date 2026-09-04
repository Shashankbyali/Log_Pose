"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { describeOpenState } from "@/lib/openingHours";
import type {
  LatLng,
  OsmPlace,
  RouteLabel,
  ScoredRoute,
  VerifiedSafeHaven,
} from "@/lib/types";
import "leaflet/dist/leaflet.css";

const ROUTE_COLORS: Record<RouteLabel, string> = {
  fastest: "#38bdf8",
  balanced: "#a78bfa",
  safest: "#34d399",
  alternative: "#a1a1aa",
};

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const originIcon = dotIcon("#38bdf8");
const destinationIcon = dotIcon("#f43f5e");

/**
 * Verified LOG POSE Safe Haven: a distinctive starred badge.
 * Deliberately different in shape, colour and iconography from OSM places so
 * an unverified business can never look officially verified.
 */
const safeHavenIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:10px;background:linear-gradient(160deg,#0d9488,#115e59);border:2px solid #5eead4;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.45)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f0fdfa"><path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z"/></svg>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Plain OpenStreetMap establishment: small neutral square, no badge. */
const osmPlaceIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:3px;background:#52525b;border:1.5px solid #a1a1aa;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const osmEmergencyIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:3px;background:#7f1d1d;border:1.5px solid #fca5a5;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.length > 0 ? `${points.length}:${points[0].lat},${points[0].lng}` : "";

  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
      { padding: [40, 40] },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

interface LogPoseMapProps {
  origin: LatLng;
  destination: LatLng;
  routes: ScoredRoute[];
  selectedRouteId: string;
  safeHavens: VerifiedSafeHaven[];
  osmPlaces: OsmPlace[];
  showOsmPlaces: boolean;
  onHavenSelect: (haven: VerifiedSafeHaven) => void;
  className?: string;
}

export default function LogPoseMap({
  origin,
  destination,
  routes,
  selectedRouteId,
  safeHavens,
  osmPlaces,
  showOsmPlaces,
  onHavenSelect,
  className,
}: LogPoseMapProps) {
  const boundsPoints = useMemo(
    () => [
      origin,
      destination,
      ...routes.flatMap((route) => route.geometry.coordinates),
    ],
    [origin, destination, routes],
  );

  const center = useMemo(
    () => ({
      lat: (origin.lat + destination.lat) / 2,
      lng: (origin.lng + destination.lng) / 2,
    }),
    [origin, destination],
  );

  return (
    <div className={className}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <FitBounds points={boundsPoints} />

        {/* Unselected routes first so the selected one draws on top. */}
        {[...routes]
          .sort((a, b) =>
            a.id === selectedRouteId ? 1 : b.id === selectedRouteId ? -1 : 0,
          )
          .map((route) => {
            const selected = route.id === selectedRouteId;
            return (
              <Polyline
                key={route.id}
                positions={route.geometry.coordinates.map(
                  (c) => [c.lat, c.lng] as [number, number],
                )}
                pathOptions={{
                  color: ROUTE_COLORS[route.label] ?? "#94a3b8",
                  weight: selected ? 6 : 3,
                  opacity: selected ? 0.95 : 0.3,
                }}
              />
            );
          })}

        <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
          <Popup>Start</Popup>
        </Marker>
        <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
          <Popup>Destination</Popup>
        </Marker>

        {showOsmPlaces &&
          osmPlaces.map((place) => (
            <Marker
              key={place.id}
              position={[place.latitude, place.longitude]}
              icon={place.isEmergencyFacility ? osmEmergencyIcon : osmPlaceIcon}
              zIndexOffset={-200}
            >
              <Popup>
                <div className="min-w-[180px] text-sm">
                  <p className="font-semibold">{place.name}</p>
                  <p className="text-zinc-400">{place.category}</p>
                  {place.distanceFromRoute !== undefined && (
                    <p className="text-zinc-400">{place.distanceFromRoute} m from route</p>
                  )}
                  <p className="text-zinc-400">{describeOpenState(place.openState)}</p>
                  <p className="mt-1.5 border-t border-zinc-700 pt-1.5 text-[11px] text-zinc-500">
                    Source: OpenStreetMap
                    <br />
                    Not LOG POSE Verified
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

        {safeHavens.map((haven) => (
          <Marker
            key={haven.id}
            position={[haven.latitude, haven.longitude]}
            icon={safeHavenIcon}
            zIndexOffset={400}
            eventHandlers={{ click: () => onHavenSelect(haven) }}
          >
            <Popup>
              <div className="min-w-[190px] text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-400">
                  LOG POSE Safe Haven
                </p>
                <p className="mt-0.5 font-semibold">{haven.name}</p>
                <p className="text-zinc-400">{haven.type}</p>
                <p className="text-zinc-400">
                  Trust Score {haven.trustScore} &middot;{" "}
                  {describeOpenState(haven.openState)}
                </p>
                <p className="mt-1.5 border-t border-zinc-700 pt-1.5 text-[11px] text-zinc-500">
                  Physically verified by LOG POSE
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
