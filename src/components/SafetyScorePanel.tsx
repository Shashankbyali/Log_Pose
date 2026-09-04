"use client";

import { DEFAULT_SAFETY_WEIGHTS } from "@/lib/safetyEngine";
import { cn, describeScore, formatScore, getScoreBarColor, getScoreColor } from "@/lib/utils";
import type { SafetyFactorScores } from "@/lib/types";

interface SafetyScorePanelProps {
  safety: SafetyFactorScores;
  routeSourceNote: string;
}

/**
 * Full transparency panel: every factor shows its measured evidence, its data
 * source, and the weight actually applied. Unavailable factors are shown as
 * "Data unavailable" and are excluded from the score rather than counted as
 * zero.
 */
export function SafetyScorePanel({ safety, routeSourceNote }: SafetyScorePanelProps) {
  const coveragePercent = Math.round(safety.dataCoverage * 100);

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Safety Score</h3>
          <p className="text-xs text-zinc-500">
            {describeScore(safety.totalScore)} based on available data
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-3xl font-semibold tabular-nums",
              getScoreColor(safety.totalScore),
            )}
          >
            {formatScore(safety.totalScore)}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            out of 100
          </p>
        </div>
      </div>

      {coveragePercent < 100 && (
        <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          {coveragePercent}% of the scoring model could be measured for this route.
          {safety.unavailableFactors.length > 0 && (
            <> Unavailable: {safety.unavailableFactors.join(", ")}.</>
          )}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {safety.factors.map((factor) => {
          const baseWeight = Math.round(
            DEFAULT_SAFETY_WEIGHTS[factor.key] * 100,
          );
          const appliedWeight = Math.round(factor.appliedWeight * 100);

          return (
            <li key={factor.key}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-zinc-200">
                  {factor.label}
                  <span className="ml-1.5 text-[10px] font-normal text-zinc-600">
                    {factor.score === null
                      ? `${baseWeight}% weight, excluded`
                      : `${appliedWeight}% of score`}
                  </span>
                </p>
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    getScoreColor(factor.score),
                  )}
                >
                  {factor.score === null ? "Data unavailable" : factor.score}
                </p>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                {factor.score !== null && (
                  <div
                    className={cn("h-full rounded-full", getScoreBarColor(factor.score))}
                    style={{ width: `${factor.score}%` }}
                  />
                )}
              </div>

              <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
                {factor.evidence}
              </p>
              <p className="text-[10px] leading-snug text-zinc-600">{factor.source}</p>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-white/5 pt-3">
        <p className="text-[11px] text-zinc-500">{routeSourceNote}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-zinc-600">
          Safety indicators are probabilistic and depend on mapped data. A higher
          Safety Score does not mean a route is safe, and missing map data does
          not mean infrastructure is absent.
        </p>
      </div>
    </section>
  );
}
