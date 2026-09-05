"use client";

import { ScoreRing } from "./ScoreRing";
import { DEFAULT_SAFETY_WEIGHTS } from "@/lib/safetyEngine";
import { cn, describeScore, getScoreBarColor, getScoreColor } from "@/lib/utils";
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
    <section className="lp-card p-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={safety.totalScore} size={72} strokeWidth={6} caption="/100" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Safety Score</h3>
          <p
            className={cn(
              "text-sm font-medium",
              getScoreColor(safety.totalScore),
            )}
          >
            {describeScore(safety.totalScore)}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
            Weighted over {coveragePercent}% of the model that could be measured
          </p>
        </div>
      </div>

      {coveragePercent < 100 && safety.unavailableFactors.length > 0 && (
        <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
          Not measured for this route: {safety.unavailableFactors.join(", ")}. These are
          excluded from the score rather than counted as zero.
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

              <div
                className={cn(
                  "mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5",
                  factor.score === null &&
                    "bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.05)_0_5px,transparent_5px_10px)]",
                )}
              >
                {factor.score !== null && (
                  <div
                    className={cn("h-full rounded-full", getScoreBarColor(factor.score))}
                    style={{
                      width: `${factor.score}%`,
                      transition: "width 500ms cubic-bezier(0.22,1,0.36,1)",
                    }}
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
