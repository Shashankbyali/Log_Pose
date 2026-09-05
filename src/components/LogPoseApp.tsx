"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./Header";
import { HomeScreen } from "./HomeScreen";
import { MapWrapper } from "./MapWrapper";
import { DemoModeBanner } from "./ModeBadge";
import { RouteComparisonCards } from "./RouteComparisonCards";
import { SafeHavenDetail } from "./SafeHavenDetail";
import { SafePlaceModal, type NavigationTarget } from "./SafePlaceModal";
import { SafetyPreferenceSelector } from "./SafetyPreferenceSelector";
import { SafetyScorePanel } from "./SafetyScorePanel";
import {
  DEMO_DESTINATION,
  DEMO_DESTINATION_NAME,
  DEMO_ORIGIN,
  DEMO_ORIGIN_NAME,
  DEMO_OSM_PLACES,
  DEMO_SAFE_HAVENS,
  getDemoPlan,
} from "@/lib/demoData";
import { getRecommendedRoute } from "@/lib/routing";
import { getSafetyTradeoff } from "@/lib/utils";
import { useGeolocation } from "@/lib/useGeolocation";
import type {
  GeocodeResult,
  LatLng,
  PlanResult,
  SafetyPreference,
  VerifiedSafeHaven,
} from "@/lib/types";

interface Trip {
  origin: LatLng;
  destination: LatLng;
  originName: string;
  destinationName: string;
  plan: PlanResult;
}

export default function LogPoseApp() {
  const geo = useGeolocation();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preference, setPreference] = useState<SafetyPreference>("balanced");
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [manualOrigin, setManualOrigin] = useState<GeocodeResult | null>(null);
  const [originMode, setOriginMode] = useState<"auto" | "manual">("auto");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedHaven, setSelectedHaven] = useState<VerifiedSafeHaven | null>(null);
  const [showSafePlace, setShowSafePlace] = useState(false);
  const [showOsmPlaces, setShowOsmPlaces] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    geo.requestLocation();
    // Requested once on mount; there is deliberately no location watching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The detected location as a selectable place. Derived rather than copied
   * into state, so a manually typed starting point always wins and a later GPS
   * fix cannot silently overwrite the user's choice.
   */
  const currentLocationPlace = useMemo<GeocodeResult | null>(
    () =>
      geo.location
        ? {
            id: "current-location",
            name: geo.locationName,
            detail: "Your current location",
            lat: geo.location.lat,
            lng: geo.location.lng,
          }
        : null,
    [geo.location, geo.locationName],
  );

  // In "manual" mode the user is in control, including having deliberately
  // cleared the field, so a GPS fix must not refill it.
  const origin = originMode === "manual" ? manualOrigin : currentLocationPlace;

  const routes = useMemo(() => trip?.plan.routes ?? [], [trip]);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? routes[0],
    [routes, selectedRouteId],
  );

  const recommendedRoute = useMemo(
    () => getRecommendedRoute(routes, preference),
    [routes, preference],
  );

  const tradeoff = useMemo(() => {
    const fastest = routes.find((route) => route.label === "fastest");
    const safest = routes.find((route) => route.label === "safest");
    if (!fastest || !safest) return null;
    return getSafetyTradeoff(fastest, safest);
  }, [routes]);

  const applyPlan = useCallback(
    (next: Trip, pref: SafetyPreference) => {
      const recommended = getRecommendedRoute(next.plan.routes, pref);
      setTrip(next);
      setSelectedRouteId(recommended?.id ?? next.plan.routes[0]?.id ?? "");
      setSelectedHaven(null);
      setError(null);
    },
    [],
  );

  const planLiveRoute = useCallback(
    async (origin: LatLng, dest: LatLng, originName: string, destName: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination: dest }),
        });
        const data = (await response.json()) as PlanResult & { error?: string };

        if (!response.ok) {
          setError(
            data.error ??
              "Route planning is unavailable right now. You can try Demo Mode.",
          );
          return;
        }

        applyPlan(
          {
            origin,
            destination: dest,
            originName,
            destinationName: destName,
            plan: data,
          },
          preference,
        );
      } catch {
        setError(
          "Could not reach the routing service. Check your connection or try Demo Mode.",
        );
      } finally {
        setLoading(false);
      }
    },
    [applyPlan, preference],
  );

  const handlePlanRoute = () => {
    if (!origin || !destination) return;
    void planLiveRoute(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng },
      origin.name,
      destination.name,
    );
  };

  const handleDemo = () => {
    setPreference("balanced");
    applyPlan(
      {
        origin: DEMO_ORIGIN,
        destination: DEMO_DESTINATION,
        originName: DEMO_ORIGIN_NAME,
        destinationName: DEMO_DESTINATION_NAME,
        plan: getDemoPlan(),
      },
      "balanced",
    );
  };

  const handleNavigateTo = (target: NavigationTarget) => {
    if (!trip) return;

    setShowSafePlace(false);
    setSelectedHaven(null);

    if (trip.plan.mode === "demo") {
      // Demo Mode has no live routing, so say so instead of silently doing
      // nothing or pretending to route.
      setError(
        "Demo Mode uses a predefined route and cannot navigate to another place. Start a live trip to route here.",
      );
      return;
    }

    setPreference("safest");
    void planLiveRoute(
      trip.origin,
      { lat: target.lat, lng: target.lng },
      trip.originName,
      target.name,
    );
  };

  if (!trip) {
    return (
      <div className="lp-ambient flex min-h-[100dvh] flex-col">
        <Header />
        <HomeScreen
          origin={origin}
          onSelectOrigin={(result) => {
            setOriginMode("manual");
            setManualOrigin(result);
          }}
          onClearOrigin={() => {
            setOriginMode("manual");
            setManualOrigin(null);
          }}
          geoStatus={geo.status}
          geoError={geo.error}
          onUseCurrentLocation={() => {
            setOriginMode("auto");
            setManualOrigin(null);
            geo.requestLocation();
          }}
          destination={destination}
          onSelectDestination={setDestination}
          onClearDestination={() => setDestination(null)}
          preference={preference}
          onPreferenceChange={setPreference}
          onPlanRoute={handlePlanRoute}
          onDemo={handleDemo}
          loading={loading}
          error={error}
        />
      </div>
    );
  }

  const isDemo = trip.plan.mode === "demo";

  return (
    <div className="lp-ambient flex h-[100dvh] flex-col">
      <Header mode={trip.plan.mode} compact />
      <DemoModeBanner visible={isDemo} />

      <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="relative h-[48vh] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
          <MapWrapper
            origin={trip.origin}
            destination={trip.destination}
            routes={routes}
            selectedRouteId={selectedRouteId}
            safeHavens={trip.plan.safeHavens}
            osmPlaces={trip.plan.osmPlaces}
            showOsmPlaces={showOsmPlaces}
            onHavenSelect={setSelectedHaven}
            className="h-full w-full"
          />

          <button
            type="button"
            onClick={() => {
              setTrip(null);
              setError(null);
            }}
            className="lp-glass lp-focus absolute left-3 top-3 z-[1000] rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:bg-white/5"
          >
            &larr; New trip
          </button>

          {trip.plan.osmPlaces.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOsmPlaces((value) => !value)}
              aria-pressed={showOsmPlaces}
              className="lp-glass lp-focus absolute right-3 top-3 z-[1000] rounded-xl px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/5"
            >
              {showOsmPlaces ? "Hide" : "Show"} OSM places
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSafePlace(true)}
            className="lp-focus group absolute bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-rose-950/50 transition hover:from-rose-500 hover:to-rose-400"
          >
            <span
              className="lp-pulse-ring relative h-2 w-2 rounded-full bg-white text-white/70"
              aria-hidden="true"
            />
            I need a safe place
          </button>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col border-t border-white/10 bg-[var(--surface-1)] lg:flex-none lg:w-[420px] lg:border-l lg:border-t-0">
          <button
            type="button"
            onClick={() => setPanelOpen((value) => !value)}
            aria-expanded={panelOpen}
            className="w-full shrink-0 py-2 text-xs text-zinc-500 transition hover:text-zinc-300 lg:hidden"
          >
            <span className="mx-auto mb-1.5 block h-1 w-9 rounded-full bg-white/15" />
            {panelOpen ? "Hide details" : "Show details"}
          </button>

          {panelOpen && (
            <div className="lp-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="lp-card p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Route to
                </p>
                <p className="mt-0.5 truncate font-medium text-white">
                  {trip.destinationName}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-zinc-500">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                  From {trip.originName}
                </p>
              </div>

              {trip.plan.warnings.length > 0 && (
                <ul className="space-y-1.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
                  {trip.plan.warnings.map((warning) => (
                    <li key={warning} className="text-xs leading-snug text-amber-200/90">
                      {warning}
                    </li>
                  ))}
                </ul>
              )}

              <SafetyPreferenceSelector
                value={preference}
                onChange={(next) => {
                  setPreference(next);
                  const recommended = getRecommendedRoute(routes, next);
                  if (recommended) setSelectedRouteId(recommended.id);
                }}
                compact
              />

              <RouteComparisonCards
                routes={routes}
                selectedRouteId={selectedRouteId}
                recommendedId={recommendedRoute?.id}
                onSelect={setSelectedRouteId}
              />

              {tradeoff && (
                <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-zinc-300">
                  Safest route costs{" "}
                  <span className="font-semibold text-white">{tradeoff.timeLabel}</span>{" "}
                  for{" "}
                  <span className="font-semibold text-emerald-300">
                    +{tradeoff.scoreDelta} Safety Score
                  </span>
                  . The choice stays yours.
                </p>
              )}

              {trip.plan.safeHavens.length > 0 && (
                <section className="rounded-2xl border border-teal-400/20 bg-teal-400/[0.04] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      Verified Safe Havens along the way
                    </h3>
                    <span className="rounded-md bg-teal-400/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-teal-300">
                      {trip.plan.safeHavens.length}
                    </span>
                  </div>
                  <ul className="mt-2.5 space-y-1">
                    {trip.plan.safeHavens.slice(0, 5).map((haven) => (
                      <li key={haven.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedHaven(haven)}
                          className="lp-focus flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-teal-400/30 bg-teal-400/10 text-[11px] font-semibold tabular-nums text-teal-300">
                            {haven.trustScore}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-zinc-100">
                              {haven.name}
                            </span>
                            <span className="block text-[11px] text-zinc-500">
                              {haven.type}
                              {haven.distanceFromRoute !== undefined &&
                                ` \u00b7 ${haven.distanceFromRoute} m from route`}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {selectedRoute && (
                <SafetyScorePanel
                  safety={selectedRoute.safety}
                  routeSourceNote={
                    isDemo
                      ? "Demo Mode: predefined demonstration measurements."
                      : selectedRoute.sourceNote
                  }
                />
              )}

              {trip.plan.osmPlaces.length > 0 && (
                <p className="text-[11px] leading-snug text-zinc-600">
                  Grey markers are OpenStreetMap establishments near the route.
                  They are not LOG POSE verified Safe Havens.
                </p>
              )}
            </div>
          )}
        </div>

        {selectedHaven && (
          <div className="absolute inset-x-4 bottom-4 z-[1500] mx-auto max-w-sm lg:inset-x-auto lg:left-4 lg:top-20 lg:bottom-auto">
            <SafeHavenDetail
              haven={selectedHaven}
              onClose={() => setSelectedHaven(null)}
              onNavigate={() =>
                handleNavigateTo({
                  lat: selectedHaven.latitude,
                  lng: selectedHaven.longitude,
                  name: selectedHaven.name,
                })
              }
            />
          </div>
        )}
      </div>

      {error && (
        <p
          className="border-t border-orange-400/25 bg-orange-400/10 px-4 py-2 text-center text-sm text-orange-200"
          role="alert"
        >
          {error}
        </p>
      )}

      {showSafePlace && (
        <SafePlaceModal
          userLocation={isDemo ? DEMO_ORIGIN : geo.location ?? trip.origin}
          demoHavens={isDemo ? DEMO_SAFE_HAVENS : null}
          demoNearbyPlaces={isDemo ? DEMO_OSM_PLACES : null}
          onClose={() => setShowSafePlace(false)}
          onNavigate={handleNavigateTo}
        />
      )}
    </div>
  );
}
