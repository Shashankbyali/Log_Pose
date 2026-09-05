"use client";

import { ScoreRing } from "./ScoreRing";
import { formatDistance, formatDuration } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { RouteLabel, ScoredRoute } from "@/lib/types";

interface RouteComparisonCardsProps {
  routes: ScoredRoute[];
  selectedRouteId: string;
  recommendedId?: string;
  onSelect: (routeId: string) => void;
}

const LABEL_TEXT: Record<RouteLabel, string> = {
  fastest: "Fastest",
  balanced: "Balanced",
  safest: "Safest",
  alternative: "Alternative",
};

const LABEL_ACCENT: Record<RouteLabel, string> = {
  fastest: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  balanced: "text-violet-300 border-violet-400/30 bg-violet-400/10",
  safest: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  alternative: "text-zinc-300 border-white/15 bg-white/5",
};

/** Matches the polyline colours on the map, so cards and routes read together. */
const LABEL_STRIPE: Record<RouteLabel, string> = {
  fastest: "bg-sky-400",
  balanced: "bg-violet-400",
  safest: "bg-emerald-400",
  alternative: "bg-zinc-500",
};

export function RouteComparisonCards({
  routes,
  selectedRouteId,
  recommendedId,
  onSelect,
}: RouteComparisonCardsProps) {
  if (routes.length === 0) return null;

  const order: RouteLabel[] = ["fastest", "balanced", "safest", "alternative"];
  const sorted = [...routes].sort(
    (a, b) => order.indexOf(a.label) - order.indexOf(b.label),
  );

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Route options">
      {sorted.map((route) => {
        const isSelected = route.id === selectedRouteId;
        const score = route.safety.totalScore;

        return (
          <button
            key={route.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(route.id)}
            className={cn(
              "lp-card lp-card-interactive lp-focus relative w-full overflow-hidden p-3.5 pl-5 text-left",
              isSelected && "border-white/25 bg-white/[0.06]",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1 transition-opacity",
                LABEL_STRIPE[route.label],
                isSelected ? "opacity-100" : "opacity-35",
              )}
              aria-hidden="true"
            />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      LABEL_ACCENT[route.label],
                    )}
                  >
                    {LABEL_TEXT[route.label]}
                  </span>
                  {route.id === recommendedId && (
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                      Matches your preference
                    </span>
                  )}
                </div>

                <p className="mt-2 text-base font-medium text-zinc-100">
                  {formatDuration(route.duration)}
                  <span className="text-sm font-normal text-zinc-500">
                    {" "}
                    &middot; {formatDistance(route.distance)}
                  </span>
                </p>

                <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-zinc-500">
                  {route.safety.reasons.slice(0, 2).join(" \u00b7 ")}
                </p>
              </div>

              <ScoreRing
                score={score}
                size={56}
                caption={score === null ? "no data" : "score"}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
