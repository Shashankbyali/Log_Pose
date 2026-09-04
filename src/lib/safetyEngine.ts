import type {
  RouteSafetyInputs,
  SafetyFactor,
  SafetyFactorKey,
  SafetyFactorScores,
  SafetyWeights,
} from "./types";

/**
 * LOG POSE Safety Engine.
 *
 * Contract:
 *  - Pure and deterministic. No fetching, no randomness, no clock reads.
 *  - Consumes only measured real-world values (see `RouteSafetyInputs`).
 *  - `null` inputs mean "data unavailable" and are NEVER coerced to zero.
 *    Unavailable factors are excluded and the remaining weights are
 *    renormalised, so a missing data source cannot silently look like danger.
 *  - `Infinity` for `nearestEmergencyMeters` means "searched, none found",
 *    which is real information and does score low.
 */

export const DEFAULT_SAFETY_WEIGHTS: SafetyWeights = {
  lighting: 0.25,
  activity: 0.2,
  safeHaven: 0.2,
  establishment: 0.15,
  accessibility: 0.1,
  emergency: 0.1,
};

/** Reference densities at which a factor is considered fully satisfied. */
export const NORMALISATION = {
  /** Mapped street lamps per km that scores 100. */
  lampsPerKmForFullScore: 30,
  /** Activity-generating establishments per km that scores 100. */
  activityPoisPerKmForFullScore: 40,
  /** Open establishments per km that scores 100. */
  openEstablishmentsPerKmForFullScore: 12,
  /** Mapped crossings per km that scores 100. */
  crossingsPerKmForFullScore: 6,
  /** Distance to nearest emergency facility scoring 100 / 0. */
  emergencyBestMeters: 250,
  emergencyWorstMeters: 3000,
} as const;

const FACTOR_LABELS: Record<SafetyFactorKey, string> = {
  lighting: "Lighting",
  activity: "Human activity",
  safeHaven: "Safe Haven availability",
  establishment: "Open establishments",
  accessibility: "Pedestrian accessibility",
  emergency: "Emergency accessibility",
};

const FACTOR_SOURCES: Record<SafetyFactorKey, string> = {
  lighting: "Mapped OpenStreetMap street-light infrastructure",
  activity: "Nearby mapped establishments (OpenStreetMap)",
  safeHaven: "LOG POSE verified Safe Haven network",
  establishment: "OpenStreetMap opening_hours where mapped",
  accessibility: "Mapped OpenStreetMap pedestrian infrastructure",
  emergency: "Geographic proximity to mapped emergency facilities",
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function ratioScore(value: number, fullScoreAt: number): number {
  if (fullScoreAt <= 0) return 0;
  return clamp(Math.round((value / fullScoreAt) * 100));
}

function perKm(count: number, distanceMeters: number): number {
  const km = Math.max(distanceMeters / 1000, 0.05);
  return count / km;
}

interface FactorResult {
  score: number | null;
  evidence: string;
}

function lightingFactor(inputs: RouteSafetyInputs): FactorResult {
  if (inputs.mappedLampsNearRoute === null) {
    return { score: null, evidence: "No mapped street-light data for this area" };
  }
  const density = perKm(inputs.mappedLampsNearRoute, inputs.routeDistanceMeters);
  return {
    score: ratioScore(density, NORMALISATION.lampsPerKmForFullScore),
    evidence: `${inputs.mappedLampsNearRoute} mapped street lamps along route (${density.toFixed(1)}/km)`,
  };
}

function activityFactor(inputs: RouteSafetyInputs): FactorResult {
  if (inputs.activityPoisNearRoute === null) {
    return { score: null, evidence: "Nearby establishment data unavailable" };
  }
  const density = perKm(inputs.activityPoisNearRoute, inputs.routeDistanceMeters);
  return {
    score: ratioScore(density, NORMALISATION.activityPoisPerKmForFullScore),
    evidence: `${inputs.activityPoisNearRoute} mapped establishments along route (${density.toFixed(1)}/km)`,
  };
}

function safeHavenFactor(inputs: RouteSafetyInputs): FactorResult {
  const havens = inputs.verifiedSafeHavensNearRoute;
  if (havens === null) {
    return { score: null, evidence: "Safe Haven network data unavailable" };
  }
  if (havens.length === 0) {
    return {
      score: 0,
      evidence: "No verified LOG POSE Safe Havens near this route",
    };
  }

  const openCount = havens.filter((h) => h.openState === "open").length;
  const otherCount = havens.length - openCount;
  const coverage = clamp(openCount * 40 + otherCount * 15);
  const avgTrust =
    havens.reduce((sum, h) => sum + h.trustScore, 0) / havens.length;

  return {
    score: clamp(Math.round(coverage * 0.5 + avgTrust * 0.5)),
    evidence: `${havens.length} verified Safe Haven${havens.length > 1 ? "s" : ""} near route (${openCount} open now, avg Trust ${Math.round(avgTrust)})`,
  };
}

function establishmentFactor(inputs: RouteSafetyInputs): FactorResult {
  const { establishmentsOpen, establishmentsClosed, establishmentsUnknown } = inputs;
  if (establishmentsOpen === null || establishmentsClosed === null) {
    return { score: null, evidence: "Opening-hours data unavailable" };
  }

  const known = establishmentsOpen + establishmentsClosed;
  if (known === 0) {
    const unknown = establishmentsUnknown ?? 0;
    return {
      score: null,
      evidence:
        unknown > 0
          ? `${unknown} nearby establishments have no mapped opening hours`
          : "No opening-hours information mapped near this route",
    };
  }

  const density = perKm(establishmentsOpen, inputs.routeDistanceMeters);
  const densityScore = ratioScore(
    density,
    NORMALISATION.openEstablishmentsPerKmForFullScore,
  );
  const openShare = Math.round((establishmentsOpen / known) * 100);
  const unknownNote =
    establishmentsUnknown && establishmentsUnknown > 0
      ? `, ${establishmentsUnknown} with unknown hours`
      : "";

  return {
    score: clamp(Math.round(densityScore * 0.6 + openShare * 0.4)),
    evidence: `${establishmentsOpen} of ${known} establishments with mapped hours are open now${unknownNote}`,
  };
}

function accessibilityFactor(inputs: RouteSafetyInputs): FactorResult {
  const { pedestrianWayMeters, pedestrianCrossings } = inputs;
  if (pedestrianWayMeters === null && pedestrianCrossings === null) {
    return { score: null, evidence: "Pedestrian infrastructure data unavailable" };
  }

  const parts: Array<{ score: number; weight: number }> = [];
  const notes: string[] = [];

  if (pedestrianWayMeters !== null) {
    const coverage = clamp(
      Math.round((pedestrianWayMeters / Math.max(inputs.routeDistanceMeters, 1)) * 100),
    );
    parts.push({ score: coverage, weight: 0.75 });
    notes.push(`${coverage}% of route has mapped footway or sidewalk`);
  }

  if (pedestrianCrossings !== null) {
    const density = perKm(pedestrianCrossings, inputs.routeDistanceMeters);
    parts.push({
      score: ratioScore(density, NORMALISATION.crossingsPerKmForFullScore),
      weight: 0.25,
    });
    notes.push(`${pedestrianCrossings} mapped crossings`);
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const score = clamp(
    Math.round(parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight),
  );

  return { score, evidence: notes.join(", ") };
}

function emergencyFactor(inputs: RouteSafetyInputs): FactorResult {
  const distance = inputs.nearestEmergencyMeters;
  if (distance === null) {
    return { score: null, evidence: "Emergency facility data unavailable" };
  }
  if (!Number.isFinite(distance)) {
    return {
      score: 0,
      evidence: "No mapped emergency facility within the searched corridor",
    };
  }

  const { emergencyBestMeters, emergencyWorstMeters } = NORMALISATION;
  const span = emergencyWorstMeters - emergencyBestMeters;
  const score = clamp(
    Math.round(100 * (1 - (distance - emergencyBestMeters) / span)),
  );

  return {
    score,
    evidence: `Nearest mapped emergency facility ${Math.round(distance)} m from route`,
  };
}

function buildReasons(factors: SafetyFactor[]): string[] {
  const reasons: string[] = [];
  const byKey = new Map(factors.map((f) => [f.key, f]));

  const lighting = byKey.get("lighting");
  if (lighting?.score !== null && lighting !== undefined) {
    if (lighting.score >= 70) reasons.push("Well-covered mapped street lighting");
    else if (lighting.score >= 40) reasons.push("Partial mapped street lighting");
    else reasons.push("Sparse mapped street lighting");
  }

  const activity = byKey.get("activity");
  if (activity?.score !== null && activity !== undefined) {
    if (activity.score >= 60) reasons.push("Higher nearby activity based on mapped establishments");
    else if (activity.score < 25) reasons.push("Few mapped establishments nearby");
  }

  const safeHaven = byKey.get("safeHaven");
  if (safeHaven && safeHaven.score !== null) {
    const match = /^(\d+) verified Safe Haven/.exec(safeHaven.evidence);
    if (match) reasons.push(`${match[1]} verified Safe Haven${Number(match[1]) > 1 ? "s" : ""} nearby`);
    else reasons.push("No verified Safe Havens nearby");
  }

  const establishment = byKey.get("establishment");
  if (establishment && establishment.score !== null && establishment.score >= 55) {
    reasons.push("More establishments open right now");
  }

  const accessibility = byKey.get("accessibility");
  if (accessibility && accessibility.score !== null && accessibility.score >= 55) {
    reasons.push("Better mapped pedestrian accessibility");
  }

  const emergency = byKey.get("emergency");
  if (emergency && emergency.score !== null && emergency.score >= 60) {
    reasons.push("Emergency facility close to route");
  }

  const unavailable = factors.filter((f) => f.score === null);
  if (unavailable.length > 0) {
    reasons.push(`${unavailable.map((f) => f.label).join(", ")}: data unavailable`);
  }

  if (reasons.length === 0) {
    reasons.push("No safety indicators available for this route");
  }

  return reasons;
}

export function calculateSafetyScore(
  inputs: RouteSafetyInputs,
  weights: SafetyWeights = DEFAULT_SAFETY_WEIGHTS,
): SafetyFactorScores {
  const results: Record<SafetyFactorKey, FactorResult> = {
    lighting: lightingFactor(inputs),
    activity: activityFactor(inputs),
    safeHaven: safeHavenFactor(inputs),
    establishment: establishmentFactor(inputs),
    accessibility: accessibilityFactor(inputs),
    emergency: emergencyFactor(inputs),
  };

  const keys = Object.keys(results) as SafetyFactorKey[];
  const availableWeight = keys.reduce(
    (sum, key) => (results[key].score === null ? sum : sum + weights[key]),
    0,
  );
  const totalWeight = keys.reduce((sum, key) => sum + weights[key], 0);

  const factors: SafetyFactor[] = keys.map((key) => ({
    key,
    label: FACTOR_LABELS[key],
    score: results[key].score,
    appliedWeight:
      results[key].score === null || availableWeight === 0
        ? 0
        : weights[key] / availableWeight,
    evidence: results[key].evidence,
    source: FACTOR_SOURCES[key],
  }));

  const totalScore =
    availableWeight === 0
      ? null
      : clamp(
          Math.round(
            factors.reduce(
              (sum, factor) =>
                factor.score === null
                  ? sum
                  : sum + factor.score * factor.appliedWeight,
              0,
            ),
          ),
        );

  return {
    totalScore,
    lightingScore: results.lighting.score,
    activityScore: results.activity.score,
    safeHavenScore: results.safeHaven.score,
    establishmentScore: results.establishment.score,
    accessibilityScore: results.accessibility.score,
    emergencyScore: results.emergency.score,
    factors,
    reasons: buildReasons(factors),
    dataCoverage: totalWeight === 0 ? 0 : availableWeight / totalWeight,
    unavailableFactors: factors
      .filter((f) => f.score === null)
      .map((f) => f.label),
  };
}
