"use client";

import Link from "next/link";
import { PlaceSearch } from "./PlaceSearch";
import { PrivacyPanel } from "./PrivacyPanel";
import { SafetyPreferenceSelector } from "./SafetyPreferenceSelector";
import type { GeocodeResult, SafetyPreference } from "@/lib/types";
import type { GeoStatus } from "@/lib/useGeolocation";

interface HomeScreenProps {
  origin: GeocodeResult | null;
  onSelectOrigin: (result: GeocodeResult) => void;
  onClearOrigin: () => void;
  geoStatus: GeoStatus;
  geoError: string | null;
  onUseCurrentLocation: () => void;
  destination: GeocodeResult | null;
  onSelectDestination: (result: GeocodeResult) => void;
  onClearDestination: () => void;
  preference: SafetyPreference;
  onPreferenceChange: (preference: SafetyPreference) => void;
  onPlanRoute: () => void;
  onDemo: () => void;
  loading: boolean;
  error: string | null;
}

export function HomeScreen({
  origin,
  onSelectOrigin,
  onClearOrigin,
  geoStatus,
  geoError,
  onUseCurrentLocation,
  destination,
  onSelectDestination,
  onClearDestination,
  preference,
  onPreferenceChange,
  onPlanRoute,
  onDemo,
  loading,
  error,
}: HomeScreenProps) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight text-white">
          Navigation apps get you there.
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          LOG POSE adds a safety intelligence layer so you can choose{" "}
          <span className="text-zinc-200">how</span> you get there.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onPlanRoute();
          }}
          className="space-y-4"
        >
          <PlaceSearch
            label="Starting point"
            placeholder="Search a starting point, or use your location"
            selected={origin}
            onSelect={onSelectOrigin}
            onClear={onClearOrigin}
            disabled={loading}
            footer={
              <div className="mt-2">
                <button
                  type="button"
                  onClick={onUseCurrentLocation}
                  disabled={loading || geoStatus === "requesting"}
                  className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  {geoStatus === "requesting"
                    ? "Getting your location..."
                    : geoStatus === "denied"
                      ? "Retry my location"
                      : "Use my current location"}
                </button>
                {geoStatus === "denied" && geoError && (
                  <p className="mt-1.5 text-[11px] text-amber-300/80">
                    {geoError} You can type a starting point instead.
                  </p>
                )}
                {geoStatus === "unsupported" && (
                  <p className="mt-1.5 text-[11px] text-amber-300/80">
                    Location is unavailable in this browser. Type a starting point
                    instead.
                  </p>
                )}
              </div>
            }
          />

          <PlaceSearch
            label="Destination"
            placeholder="Search a destination in Bengaluru"
            selected={destination}
            onSelect={onSelectDestination}
            onClear={onClearDestination}
            disabled={loading}
          />

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Route priority
            </p>
            <SafetyPreferenceSelector value={preference} onChange={onPreferenceChange} />
          </div>

          {error && (
            <p
              className="rounded-lg border border-orange-400/25 bg-orange-400/10 px-3 py-2 text-sm text-orange-200"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !destination || !origin}
            className="w-full rounded-xl bg-teal-500 py-3.5 text-base font-semibold text-zinc-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Measuring routes..." : "Compare routes"}
          </button>

          {!loading && (!origin || !destination) && (
            <p className="text-center text-xs text-zinc-500">
              {!origin
                ? "Set a starting point to measure real walking routes."
                : "Choose a destination to compare routes."}
            </p>
          )}
        </form>

        <div className="mt-4 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={onDemo}
            disabled={loading}
            className="w-full rounded-xl border border-amber-400/25 bg-amber-400/5 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-50"
          >
            Try Demo Mode
          </button>
          <p className="mt-2 text-center text-[11px] text-zinc-600">
            Demo Mode uses predefined demonstration data and is clearly labelled.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-semibold text-white">
          Verified Safe Haven network
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          A business does not become a LOG POSE Safe Haven by registering. It
          must pass a physical verification visit by our team before receiving
          the verified designation.
        </p>
        <Link
          href="/register"
          className="mt-3 inline-block rounded-xl border border-white/15 px-3.5 py-2 text-xs font-medium text-zinc-100 transition hover:bg-white/5"
        >
          Register your establishment as a Safe Haven
        </Link>
      </div>

      <PrivacyPanel />

      <p className="pb-2 text-center text-[11px] leading-relaxed text-zinc-600">
        Safety indicators are probabilistic and depend on available mapped data.
        LOG POSE does not claim any route or place is safe.
        <br />
        Map data &copy; OpenStreetMap contributors. Routing by OSRM.
      </p>
    </main>
  );
}
