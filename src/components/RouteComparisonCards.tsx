"use client";

import { formatDistance, formatDuration } from "@/lib/geo";
import { cn, formatScore, getScoreColor } from "@/lib/utils";
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
              "w-full rounded-2xl border p-3.5 text-left transition",
              isSelected
                ? "border-white/25 bg-white/[0.07]"
                : "border-white/10 bg-zinc-900/50 hover:border-white/20",
            )}
          >
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

                <p className="mt-2 text-sm text-zinc-200">
                  {formatDuration(route.duration)}
                  <span className="text-zinc-500"> &middot; </span>
                  {formatDistance(route.distance)}
                </p>

                <p className="mt-1.5 line-clamp-2 text-xs text-zinc-500">
                  {route.safety.reasons.slice(0, 2).join(" \u00b7 ")}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className={cn("text-2xl font-semibold tabular-nums", getScoreColor(score))}>
                  {formatScore(score)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {score === null ? "No data" : "Safety Score"}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
