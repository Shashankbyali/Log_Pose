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
    <main className="relative isolate mx-auto flex min-h-[calc(100dvh-65px)] w-full flex-1 flex-col gap-10 overflow-hidden px-4 py-10 sm:px-8 sm:py-12 lg:px-16 lg:py-16 xl:px-24">
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block"
        aria-hidden="true"
      >
        <div className="lp-orbit-scene lp-scroll-drift">
          <div className="lp-orbit lp-orbit-one" />
          <div className="lp-orbit lp-orbit-two" />
          <div className="lp-orbit lp-orbit-three" />
          <div className="lp-route-line lp-route-line-one" />
          <div className="lp-route-line lp-route-line-two" />
          <span className="lp-route-node lp-route-node-one" />
          <span className="lp-route-node lp-route-node-two" />
          <span className="lp-route-node lp-route-node-three" />
          <span className="lp-route-node lp-route-node-four" />
          <div className="lp-orbit-core">
            <span className="lp-core-cross lp-core-cross-horizontal" />
            <span className="lp-core-cross lp-core-cross-vertical" />
            <span className="lp-core-dot" />
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="lp-fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-400/8 px-2.5 py-1 text-[11px] font-medium text-teal-300">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            Walking navigation &middot; Bengaluru
          </span>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
            Navigation apps get you there.
            <br />
            <span className="lp-gradient-text lp-gradient-text-animated">
              LOG POSE cares how.
            </span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Compare walking routes by measured safety indicators &mdash;
            lighting, activity, open establishments, pedestrian paths and
            emergency access &mdash; not just by ETA.
          </p>
        </div>

        <div className="lp-card lp-fade-up w-full p-6 sm:p-8">
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
                    suppressHydrationWarning
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
                      Location is unavailable in this browser. Type a starting
                      point instead.
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
              <SafetyPreferenceSelector
                value={preference}
                onChange={onPreferenceChange}
              />
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
              suppressHydrationWarning
              className="lp-focus flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand)] to-[#e7c373] py-3.5 text-base font-semibold text-[#10252a] shadow-lg shadow-[var(--brand-glow)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-[var(--surface-3)] disabled:to-[var(--surface-3)] disabled:text-zinc-400 disabled:shadow-none"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
              )}
              {loading ? (
                <span className="lp-loading-status" aria-live="polite">
                  <span>Measuring walking routes...</span>
                  <span>Checking street lighting...</span>
                  <span>Finding nearby Safe Havens...</span>
                  <span>Comparing Safety Scores...</span>
                </span>
              ) : (
                "Compare routes"
              )}
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
              suppressHydrationWarning
              className="w-full rounded-xl border border-amber-400/25 bg-amber-400/5 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-50"
            >
              Try Demo Mode
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-600">
              Demo Mode uses predefined demonstration data and is clearly
              labelled.
            </p>
          </div>
        </div>

        <div className="lp-card lp-fade-up lp-scroll-reveal p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-teal-400/25 bg-teal-400/10 text-teal-300">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" />
              </svg>
            </span>
            <h2 className="text-sm font-semibold text-white">
              Verified Safe Haven network
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            A business does not become a LOG POSE Safe Haven by registering. It
            must pass a physical verification visit by our team before receiving
            the verified designation. Where the network has no coverage yet, LOG
            POSE will show nearby OpenStreetMap establishments instead &mdash;
            clearly marked as unverified.
          </p>
          <Link
            href="/register"
            className="lp-focus mt-3 inline-block rounded-xl border border-white/15 px-3.5 py-2 text-xs font-medium text-zinc-100 transition hover:border-white/25 hover:bg-white/5"
          >
            Register your establishment as a Safe Haven
          </Link>
        </div>

        <div className="lp-scroll-reveal">
          <PrivacyPanel />
        </div>

        <p className="pb-2 text-center text-[11px] leading-relaxed text-zinc-600">
          Safety indicators are probabilistic and depend on available mapped
          data. LOG POSE does not claim any route or place is safe.
          <br />
          Map data &copy; OpenStreetMap contributors. Routing by OSRM.
        </p>
      </div>
    </main>
  );
}
