"use client";

import { useEffect, useState } from "react";
import { EmergencyAccessBadge, OpenStatePill } from "./PlaceBadges";
import { formatDistance } from "@/lib/geo";
import { formatWalkingEta } from "@/lib/walkingEta";
import type { EmergencySearchResult, LatLng, NearbyPlaceOption } from "@/lib/types";

interface EmergencyModePanelProps {
  location: LatLng | null;
  locationStatus: "idle" | "requesting" | "granted" | "denied" | "unsupported";
  locationError: string | null;
  onClose: () => void;
  onNavigate: (place: NearbyPlaceOption, walkingDurationSeconds: number | null) => void;
}

function eta(seconds: number | null): string {
  return seconds === null ? "ETA unavailable" : formatWalkingEta(seconds);
}

export function EmergencyModePanel({
  location,
  locationStatus,
  locationError,
  onClose,
  onNavigate,
}: EmergencyModePanelProps) {
  const [result, setResult] = useState<EmergencySearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorLocationKey, setErrorLocationKey] = useState<string | null>(null);

  const locationKey = location ? `${location.lat},${location.lng}` : null;
  const resultForLocation =
    result && `${result.location.lat},${result.location.lng}` === locationKey
      ? result
      : null;
  const visibleError = errorLocationKey === locationKey ? error : null;
  const loading = Boolean(location && !resultForLocation && !visibleError);

  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();

    fetch("/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as EmergencySearchResult & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Emergency search unavailable");
        setResult(data);
      })
      .catch((requestError: unknown) => {
        if ((requestError as Error).name !== "AbortError") {
          setError("Emergency facilities could not be loaded. Try again shortly.");
          setErrorLocationKey(locationKey);
        }
      });

    return () => controller.abort();
  }, [location, locationKey]);

  const shareLocation = async () => {
    if (!location) return;
    const text = `My current location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    if (navigator.share) {
      await navigator.share({ title: "LOG POSE emergency location", text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="lp-sheet-in lp-glass max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-rose-400/30 p-5 shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-label="Emergency mode">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">Emergency Mode</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Get help nearby</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close emergency mode" className="rounded-lg px-2 py-1 text-xl text-zinc-400 hover:bg-white/5 hover:text-white">&times;</button>
        </div>

        {locationStatus === "requesting" && <p className="mt-4 text-sm text-zinc-300">Acquiring your current location...</p>}
        {locationStatus !== "requesting" && !location && <p className="mt-4 text-sm text-rose-200">{locationError ?? "Current location unavailable."}</p>}
        {location && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">Current location acquired. Location is used for this request only.</p>}

        {loading && <p className="mt-4 text-sm text-zinc-400">Finding mapped emergency facilities...</p>}
        {visibleError && <p className="mt-4 text-sm text-rose-200">{visibleError}</p>}
        {resultForLocation?.warning && <p className="mt-4 text-xs text-amber-200">Emergency facility data unavailable. Call 112 if you need immediate help.</p>}

        {resultForLocation?.police && (
          <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/5 p-4">
            <EmergencyAccessBadge />
            <h3 className="mt-2 font-semibold text-white">Nearest Police Station</h3>
            <p className="mt-1 text-sm text-zinc-200">{resultForLocation.police.name}</p>
            <p className="mt-2 text-xs text-zinc-400">
              {formatDistance(resultForLocation.police.distanceMeters)} away &middot; {eta(resultForLocation.police.walkingDurationSeconds)} walk
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href="tel:112" className="rounded-xl bg-rose-500 px-3 py-2.5 text-center text-xs font-semibold text-white hover:bg-rose-400">Call 112</a>
              {resultForLocation.police.phone ? <a href={`tel:${resultForLocation.police.phone}`} className="rounded-xl border border-rose-300/30 px-3 py-2.5 text-center text-xs font-semibold text-rose-100 hover:bg-rose-500/10">Call station</a> : <span className="rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs text-zinc-500">Phone unavailable</span>}
            </div>
          </div>
        )}

        {resultForLocation && resultForLocation.facilities.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-white">Nearby official facilities</h3>
            <ul className="mt-2 space-y-2">
              {resultForLocation.facilities.map((place) => (
                <li key={place.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><EmergencyAccessBadge /><p className="mt-1 font-medium text-zinc-100">{place.name}</p><p className="text-xs capitalize text-zinc-500">{place.category.replaceAll("_", " ")}</p></div>
                    <OpenStatePill state={place.openState} />
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">{eta(place.walkingDurationSeconds)} walk</p>
                  <button type="button" onClick={() => onNavigate(place, place.walkingDurationSeconds)} className="mt-2 w-full rounded-lg border border-white/15 py-2 text-xs font-medium text-zinc-100 hover:bg-white/5">View route</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <a href="tel:112" className="rounded-xl bg-rose-500 py-3 text-center text-xs font-semibold text-white hover:bg-rose-400">Call emergency services</a>
          <button type="button" onClick={() => void shareLocation()} className="rounded-xl border border-white/15 py-3 text-xs font-semibold text-zinc-100 hover:bg-white/5">Share location</button>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-zinc-600">LOG POSE does not automatically notify police. Use the call and sharing actions above.</p>
      </section>
    </div>
  );
}
