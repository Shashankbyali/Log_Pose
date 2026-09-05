"use client";

import { useEffect, useMemo, useState } from "react";
import { OpenStatePill, UnverifiedBadge, VerifiedBadge } from "./PlaceBadges";
import { formatDistance, formatDuration } from "@/lib/geo";
import { rankNearbyPlaces, rankSafePlaces } from "@/lib/safePlaceRanking";
import type {
  LatLng,
  NearbyPlace,
  NearbyPlaceOption,
  SafePlaceOption,
  SafePlaceSearchResult,
  SafeWalkDestinationKind,
  VerifiedSafeHaven,
} from "@/lib/types";

export interface NavigationTarget {
  lat: number;
  lng: number;
  name: string;
  /**
   * Carried through so a Safe Walk knows whether anyone at the destination
   * can actually be contacted. An OSM place has no LOG POSE relationship.
   */
  kind: SafeWalkDestinationKind;
  /** Set only for verified Safe Havens, so escalation can reach them. */
  safeHavenId: string | null;
}

interface SafePlaceModalProps {
  /**
   * Where the trip was planned from. This is the position the user actually
   * asserted, so it is the default search centre -- LOG POSE does no location
   * watching, so a stale GPS fix must not silently override it.
   */
  tripOrigin: LatLng;
  tripOriginName: string;
  /** A device GPS fix, when one is available and the user opts into it. */
  currentLocation: LatLng | null;
  /** In Demo Mode the predefined places are ranked locally instead of via the API. */
  demoHavens: VerifiedSafeHaven[] | null;
  demoNearbyPlaces: NearbyPlace[] | null;
  onClose: () => void;
  onNavigate: (target: NavigationTarget) => void;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; result: SafePlaceSearchResult }
  | { kind: "error"; message: string };

type SearchFrom = "trip" | "gps";

const DEMO_SEARCH_RADIUS_METERS = 2500;

function DistanceLine({
  distanceMeters,
  walkingDistanceMeters,
  walkingDurationSeconds,
}: {
  distanceMeters: number;
  walkingDistanceMeters: number | null;
  walkingDurationSeconds: number | null;
}) {
  if (walkingDistanceMeters !== null && walkingDurationSeconds !== null) {
    return (
      <span className="text-zinc-200">
        {formatDuration(walkingDurationSeconds)} walk
        <span className="text-zinc-600"> &middot; </span>
        {formatDistance(walkingDistanceMeters)}
      </span>
    );
  }

  return (
    <span className="text-zinc-200">
      {formatDistance(distanceMeters)}
      <span className="text-zinc-500"> straight line</span>
    </span>
  );
}

function VerifiedCard({
  option,
  onNavigate,
}: {
  option: SafePlaceOption;
  onNavigate: (target: NavigationTarget) => void;
}) {
  return (
    <li className="lp-card lp-fade-up overflow-hidden border-teal-400/20">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <VerifiedBadge />
            <p className="mt-2 truncate font-semibold text-white">{option.name}</p>
            <p className="text-xs text-zinc-400">{option.type}</p>
          </div>
          <div className="shrink-0 rounded-xl border border-teal-400/20 bg-teal-400/8 px-2.5 py-1.5 text-center">
            <p className="text-base font-semibold leading-none tabular-nums text-teal-300">
              {option.trustScore}
            </p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-teal-400/70">
              Trust
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <DistanceLine {...option} />
          <OpenStatePill state={option.openState} />
        </div>

        {option.assistanceOptions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {option.assistanceOptions.slice(0, 5).map((assistance) => (
              <li
                key={assistance}
                className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-300"
              >
                {assistance}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() =>
            onNavigate({
              lat: option.latitude,
              lng: option.longitude,
              name: option.name,
              kind: "verified_haven",
              safeHavenId: option.id,
            })
          }
          className="lp-focus mt-3.5 w-full rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-teal-400"
        >
          Walk here
        </button>
      </div>
    </li>
  );
}

function NearbyCard({
  option,
  onNavigate,
}: {
  option: NearbyPlaceOption;
  onNavigate: (target: NavigationTarget) => void;
}) {
  return (
    <li className="lp-fade-up rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <UnverifiedBadge />
          <p className="mt-2 truncate font-medium text-zinc-100">{option.name}</p>
          <p className="text-xs text-zinc-500">
            {option.category}
            {option.isEmergencyFacility && (
              <span className="text-rose-300/80"> &middot; Emergency facility</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <DistanceLine {...option} />
        <OpenStatePill state={option.openState} />
      </div>

      <button
        type="button"
        onClick={() =>
          onNavigate({
            lat: option.latitude,
            lng: option.longitude,
            name: option.name,
            kind: "osm_place",
            safeHavenId: null,
          })
        }
        className="lp-focus mt-3.5 w-full rounded-xl border border-white/15 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/5"
      >
        Walk here
      </button>
    </li>
  );
}

function SectionHeading({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <div className="mb-2.5">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {count !== undefined && (
          <span className="text-xs tabular-nums text-zinc-600">{count}</span>
        )}
      </div>
      <p className="text-[11px] leading-snug text-zinc-500">{subtitle}</p>
    </div>
  );
}

/**
 * "I need a safe place".
 *
 * Verified LOG POSE Safe Havens always come first and are always styled
 * distinctly. Unverified OpenStreetMap establishments are offered underneath
 * as a fallback, because the verified network does not cover every area yet --
 * but they are labelled as unverified, carry no Trust Score, and are never
 * called Safe Havens.
 */
export function SafePlaceModal({
  tripOrigin,
  tripOriginName,
  currentLocation,
  demoHavens,
  demoNearbyPlaces,
  onClose,
  onNavigate,
}: SafePlaceModalProps) {
  const [searchFrom, setSearchFrom] = useState<SearchFrom>("trip");

  const userLocation =
    searchFrom === "gps" && currentLocation ? currentLocation : tripOrigin;
  const locationKey = `${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}`;

  // Results are stored against the location they were fetched for, so
  // switching the search centre shows the loading state without the effect
  // having to reset state synchronously.
  const [remote, setRemote] = useState<{ key: string; state: LoadState } | null>(null);

  // Demo Mode ranks its predefined places locally and synchronously, so it is
  // derived rather than fetched.
  const demoState = useMemo<LoadState | null>(() => {
    if (!demoHavens) return null;
    return {
      kind: "ready",
      result: {
        verified: rankSafePlaces(userLocation, demoHavens, DEMO_SEARCH_RADIUS_METERS),
        verifiedWarning: null,
        nearby: demoNearbyPlaces
          ? rankNearbyPlaces(userLocation, demoNearbyPlaces)
          : null,
        nearbyWarning: null,
        searchRadiusMeters: DEMO_SEARCH_RADIUS_METERS,
      },
    };
  }, [demoHavens, demoNearbyPlaces, userLocation]);

  const state: LoadState =
    demoState ??
    (remote?.key === locationKey ? remote.state : { kind: "loading" });

  useEffect(() => {
    if (demoHavens) return;

    const controller = new AbortController();
    const [lat, lng] = locationKey.split(",").map(Number);

    (async () => {
      try {
        const response = await fetch("/api/safe-places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: { lat, lng } }),
          signal: controller.signal,
        });
        const data = (await response.json()) as SafePlaceSearchResult & {
          error?: string;
        };

        if (!response.ok) {
          setRemote({
            key: locationKey,
            state: {
              kind: "error",
              message: data.error ?? "Could not search for nearby places.",
            },
          });
          return;
        }

        setRemote({ key: locationKey, state: { kind: "ready", result: data } });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setRemote({
          key: locationKey,
          state: {
            kind: "error",
            message: "Could not reach the search service. Check your connection.",
          },
        });
      }
    })();

    return () => controller.abort();
  }, [locationKey, demoHavens]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const result = state.kind === "ready" ? state.result : null;
  const verified = result?.verified ?? [];
  const nearby = result?.nearby ?? [];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Find a safe place nearby"
    >
      <div className="lp-sheet-in lp-glass flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Safe places nearby</h2>
            <p className="text-xs text-zinc-500">
              Verified Safe Havens first, then other nearby establishments
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="lp-focus shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 bg-white/[0.02] px-5 py-2.5">
          <p className="min-w-0 text-[11px] text-zinc-400">
            Searching near{" "}
            <span className="font-medium text-zinc-200">
              {searchFrom === "gps" ? "your current location" : tripOriginName}
            </span>
          </p>
          {currentLocation && (
            <button
              type="button"
              onClick={() => setSearchFrom(searchFrom === "gps" ? "trip" : "gps")}
              className="lp-focus shrink-0 rounded-lg border border-white/15 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/5"
            >
              {searchFrom === "gps"
                ? "Search near trip start"
                : "Search near my location"}
            </button>
          )}
        </div>

        <a
          href="tel:112"
          className="flex items-center justify-between gap-3 border-b border-rose-400/20 bg-rose-500/10 px-5 py-2.5 transition hover:bg-rose-500/15"
        >
          <span className="text-xs text-rose-100">
            In immediate danger? Call emergency services.
          </span>
          <span className="shrink-0 rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white">
            Call 112
          </span>
        </a>

        <div className="lp-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {state.kind === "loading" && (
            <ul className="space-y-3" aria-label="Searching">
              {[0, 1, 2].map((index) => (
                <li key={index} className="lp-skeleton h-28 rounded-2xl" />
              ))}
            </ul>
          )}

          {state.kind === "error" && (
            <div className="rounded-2xl border border-orange-400/25 bg-orange-400/10 px-4 py-3">
              <p className="text-sm text-orange-200">{state.message}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-orange-200/70">
                Nothing is shown rather than guessed. In an emergency, call 112.
              </p>
            </div>
          )}

          {result && (
            <>
              <section>
                <SectionHeading
                  title="Verified Safe Havens"
                  subtitle="Physically verified by LOG POSE and committed to assisting"
                  count={result.verified === null ? undefined : verified.length}
                />

                {result.verified === null ? (
                  <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3.5 py-3 text-xs leading-relaxed text-amber-200/90">
                    {result.verifiedWarning ??
                      "The verified Safe Haven network could not be reached."}
                  </p>
                ) : verified.length === 0 ? (
                  <p className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
                    No verified Safe Havens within{" "}
                    {formatDistance(result.searchRadiusMeters)}. The verified network is
                    still expanding in this area.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {verified.map((option) => (
                      <VerifiedCard
                        key={option.id}
                        option={option}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <SectionHeading
                  title="Other places nearby"
                  subtitle="From OpenStreetMap. Not checked by LOG POSE."
                  count={result.nearby === null ? undefined : nearby.length}
                />

                <div className="mb-3 flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3.5 py-2.5">
                  <span className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true">
                    &#9888;
                  </span>
                  <p className="text-[11px] leading-relaxed text-amber-100/90">
                    These are ordinary businesses listed on OpenStreetMap. Nobody has
                    visited them, they have no Trust Score, and they have not agreed to
                    help. Prefer a verified Safe Haven whenever one is available.
                  </p>
                </div>

                {result.nearby === null ? (
                  <p className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
                    {result.nearbyWarning ??
                      "Nearby establishments could not be listed right now."}
                  </p>
                ) : nearby.length === 0 ? (
                  <p className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
                    No open or unknown-hours establishments are mapped close by. Places
                    OpenStreetMap says are currently closed are not listed.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {nearby.map((option) => (
                      <NearbyCard
                        key={option.id}
                        option={option}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <div className="border-t border-white/8 px-5 py-3">
          <p className="text-[11px] leading-snug text-zinc-600">
            Verification cannot guarantee that any establishment will be able to assist
            in every circumstance. Opening hours come from OpenStreetMap and may be out
            of date.
          </p>
        </div>
      </div>
    </div>
  );
}
