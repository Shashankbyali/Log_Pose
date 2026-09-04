"use client";

import { useEffect, useMemo, useState } from "react";
import { VerifiedBadge } from "./SafeHavenDetail";
import { formatDistance, formatDuration } from "@/lib/geo";
import { describeOpenState } from "@/lib/openingHours";
import { rankSafePlaces } from "@/lib/safePlaceRanking";
import type { LatLng, SafePlaceOption, VerifiedSafeHaven } from "@/lib/types";

interface SafePlaceModalProps {
  userLocation: LatLng;
  /** In Demo Mode the predefined havens are ranked locally instead of via the API. */
  demoHavens: VerifiedSafeHaven[] | null;
  onClose: () => void;
  onNavigate: (haven: VerifiedSafeHaven) => void;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; options: SafePlaceOption[] }
  | { kind: "error"; message: string };

export function SafePlaceModal({
  userLocation,
  demoHavens,
  onClose,
  onNavigate,
}: SafePlaceModalProps) {
  const [remoteState, setRemoteState] = useState<LoadState>({ kind: "loading" });

  // Demo Mode ranks its predefined havens locally and synchronously, so it is
  // derived rather than fetched.
  const demoState = useMemo<LoadState | null>(
    () =>
      demoHavens
        ? { kind: "ready", options: rankSafePlaces(userLocation, demoHavens) }
        : null,
    [demoHavens, userLocation],
  );

  const state = demoState ?? remoteState;

  useEffect(() => {
    if (demoHavens) return;

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/safe-places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: userLocation }),
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          options?: SafePlaceOption[];
          error?: string;
        };

        if (!response.ok) {
          setRemoteState({
            kind: "error",
            message: data.error ?? "Could not search the Safe Haven network.",
          });
          return;
        }

        setRemoteState({ kind: "ready", options: data.options ?? [] });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setRemoteState({
          kind: "error",
          message: "Could not reach the Safe Haven network. Check your connection.",
        });
      }
    })();

    return () => controller.abort();
  }, [userLocation, demoHavens]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Find a nearby verified Safe Haven"
    >
      <div className="max-h-[85dvh] w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Nearby verified Safe Havens
            </h2>
            <p className="text-xs text-zinc-500">
              Ranked by distance, current availability and Trust Score
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            &times;
          </button>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto px-5 py-4">
          {state.kind === "loading" && (
            <p className="py-8 text-center text-sm text-zinc-500">
              Searching the verified Safe Haven network...
            </p>
          )}

          {state.kind === "error" && (
            <div className="rounded-xl border border-orange-400/25 bg-orange-400/10 px-4 py-3">
              <p className="text-sm text-orange-200">{state.message}</p>
              <p className="mt-1.5 text-xs text-orange-200/70">
                LOG POSE will not show unverified businesses as Safe Havens.
              </p>
            </div>
          )}

          {state.kind === "ready" && state.options.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-4">
              <p className="text-sm text-zinc-200">
                No verified LOG POSE Safe Havens found nearby.
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                The verified network is still expanding in this area. In an
                emergency, contact local emergency services on 112.
              </p>
            </div>
          )}

          {state.kind === "ready" && state.options.length > 0 && (
            <ul className="space-y-3">
              {state.options.map((option) => (
                <li
                  key={option.id}
                  className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
                >
                  <VerifiedBadge />
                  <p className="mt-2 font-semibold text-white">{option.name}</p>
                  <p className="text-xs text-zinc-400">{option.type}</p>

                  <p className="mt-2 text-sm text-zinc-200">
                    {option.walkingDistanceMeters !== null &&
                    option.walkingDurationSeconds !== null ? (
                      <>
                        {formatDistance(option.walkingDistanceMeters)}
                        <span className="text-zinc-500"> &middot; </span>
                        {formatDuration(option.walkingDurationSeconds)} walk
                      </>
                    ) : (
                      <>
                        {formatDistance(option.distanceMeters)} away
                        <span className="text-zinc-500"> (straight line)</span>
                      </>
                    )}
                  </p>

                  <p className="mt-0.5 text-xs text-zinc-400">
                    Trust Score {option.trustScore}
                    <span className="text-zinc-600"> &middot; </span>
                    {describeOpenState(option.openState)}
                  </p>

                  {option.assistanceOptions.length > 0 && (
                    <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
                      {option.assistanceOptions.slice(0, 6).map((assistance) => (
                        <li
                          key={assistance}
                          className="flex items-start gap-1.5 text-[11px] text-zinc-300"
                        >
                          <span className="mt-0.5 text-teal-400" aria-hidden="true">
                            &#10003;
                          </span>
                          {assistance}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() => onNavigate(option)}
                    className="mt-3 w-full rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-teal-400"
                  >
                    Walk here
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          <p className="text-[11px] leading-snug text-zinc-600">
            Verified Safe Havens have passed a physical verification visit.
            Verification cannot guarantee that an establishment will be able to
            assist in every circumstance. In an emergency, call 112.
          </p>
        </div>
      </div>
    </div>
  );
}
