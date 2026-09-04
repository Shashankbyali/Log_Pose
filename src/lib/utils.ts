import type { ScoredRoute } from "./types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * The trade-off between two routes, e.g. "+4 min for +37 Safety Score".
 * Returns null when either route has no computable Safety Score, so the UI
 * cannot imply a comparison the data does not support.
 */
export function getSafetyTradeoff(
  fastest: ScoredRoute,
  safest: ScoredRoute,
): { timeLabel: string; scoreDelta: number } | null {
  if (fastest.id === safest.id) return null;
  if (fastest.safety.totalScore === null || safest.safety.totalScore === null) {
    return null;
  }

  const minutes = Math.round((safest.duration - fastest.duration) / 60);
  const scoreDelta = safest.safety.totalScore - fastest.safety.totalScore;
  if (scoreDelta <= 0) return null;

  return {
    timeLabel:
      minutes > 0 ? `+${minutes} min` : minutes < 0 ? `${minutes} min` : "no extra time",
    scoreDelta,
  };
}

export function getScoreColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score >= 70) return "text-emerald-400";
  if (score >= 45) return "text-amber-400";
  return "text-orange-400";
}

export function getScoreBarColor(score: number | null): string {
  if (score === null) return "bg-zinc-700";
  if (score >= 70) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-orange-500";
}

/** Wording that never overstates certainty. */
export function describeScore(score: number | null): string {
  if (score === null) return "Not enough data";
  if (score >= 70) return "Stronger indicators";
  if (score >= 45) return "Mixed indicators";
  return "Weaker indicators";
}

export function formatScore(score: number | null): string {
  return score === null ? "--" : String(score);
}
