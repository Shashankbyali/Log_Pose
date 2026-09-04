"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "./types";

/**
 * One-shot browser geolocation.
 *
 * Privacy by design: the position is requested only when the user acts on it,
 * it is held in component state, and it is never streamed or persisted. There
 * is deliberately no `watchPosition` here.
 */

export type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

export interface GeolocationState {
  location: LatLng | null;
  locationName: string;
  status: GeoStatus;
  error: string | null;
  requestLocation: () => void;
}

export function useGeolocation(): GeolocationState {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationName, setLocationName] = useState("Location not set");
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      setError("This browser does not support location access.");
      return;
    }

    setStatus("requesting");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latLng: LatLng = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(latLng);
        setLocationName("Your current location");
        setStatus("granted");

        try {
          const response = await fetch(
            `/api/reverse-geocode?${new URLSearchParams({
              lat: String(latLng.lat),
              lng: String(latLng.lng),
            })}`,
          );
          if (response.ok) {
            const data = (await response.json()) as { name?: string };
            if (data.name) setLocationName(data.name);
          }
        } catch {
          // Keep the generic label; the coordinates are what matter.
        }
      },
      () => {
        setStatus("denied");
        setError("Location permission unavailable.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { location, locationName, status, error, requestLocation };
}
