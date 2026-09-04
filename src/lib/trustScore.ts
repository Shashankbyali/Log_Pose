/**
 * LOG POSE Safe Haven Trust Score.
 *
 * Trust Score is deliberately SEPARATE from the route Safety Score:
 *  - Safety Score  = assessment of a route / environment.
 *  - Trust Score   = reliability of a registered Safe Haven, derived from the
 *                    verification outcome and the facilities confirmed on site.
 *
 * It is computed deterministically from the stored record. A business can
 * never choose or influence its own Trust Score, and a Trust Score is never a
 * guarantee of personal safety.
 */

export interface TrustScoreInput {
  verificationStatus: string;
  fieldVerificationCompleted: boolean;
  verificationNotes: string | null;
  phone: string | null;
  address: string | null;
  openingHours: string | null;
  is247: boolean;
  employeeCount: number | null;
  staffAvailable: boolean;
  securityAvailable: boolean;
  securityHours: string | null;
  femaleStaffAvailable: boolean;
  safeRoom: boolean;
  waitingArea: boolean;
  seating: boolean;
  restroom: boolean;
  temporaryShelter: boolean;
  staffAssistance: boolean;
  firstAid: boolean;
  cctv: boolean;
  emergencyExit: boolean;
  fireExtinguisher: boolean;
  emergencyAlarm: boolean;
  wheelchairAccessible: boolean;
  accessibleEntrance: boolean;
  accessibleRestroom: boolean;
  elevator: boolean;
  assistanceOptions: string[];
}

export const TRUST_WEIGHTS = {
  verification: 0.25,
  operatingInfo: 0.15,
  staffing: 0.15,
  safetyFacilities: 0.2,
  accessibility: 0.1,
  emergencySupport: 0.15,
} as const;

export interface TrustScoreBreakdown {
  total: number;
  verification: number;
  operatingInfo: number;
  staffing: number;
  safetyFacilities: number;
  accessibility: number;
  emergencySupport: number;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function countTrue(flags: boolean[]): number {
  return flags.filter(Boolean).length;
}

function verificationScore(input: TrustScoreInput): number {
  if (input.verificationStatus === "suspended") return 0;
  if (input.verificationStatus !== "verified") return 0;

  let score = 60; // Approved by a LOG POSE admin.
  if (input.fieldVerificationCompleted) score += 25;
  if (input.verificationNotes && input.verificationNotes.trim().length >= 20) {
    score += 10;
  }
  if (input.phone && input.address) score += 5;
  return Math.min(100, score);
}

function operatingInfoScore(input: TrustScoreInput): number {
  if (input.is247) return 100;
  const hasHours = Boolean(input.openingHours && input.openingHours.trim());
  if (!hasHours) return 0;
  // Documented hours are good; round-the-clock availability is better.
  return 70;
}

function staffingScore(input: TrustScoreInput): number {
  let score = 0;
  if (input.staffAvailable) score += 45;
  if (input.securityAvailable) score += 25;
  if (input.securityHours && input.securityHours.trim()) score += 5;
  if (input.femaleStaffAvailable) score += 10;

  const employees = input.employeeCount ?? 0;
  if (employees >= 10) score += 15;
  else if (employees >= 4) score += 10;
  else if (employees >= 1) score += 5;

  return Math.min(100, score);
}

function safetyFacilitiesScore(input: TrustScoreInput): number {
  const flags = [
    input.safeRoom,
    input.waitingArea,
    input.seating,
    input.restroom,
    input.temporaryShelter,
    input.staffAssistance,
    input.cctv,
  ];
  return pct(countTrue(flags), flags.length);
}

function accessibilityScore(input: TrustScoreInput): number {
  const flags = [
    input.wheelchairAccessible,
    input.accessibleEntrance,
    input.accessibleRestroom,
    input.elevator,
  ];
  return pct(countTrue(flags), flags.length);
}

function emergencySupportScore(input: TrustScoreInput): number {
  const flags = [
    input.firstAid,
    input.emergencyExit,
    input.fireExtinguisher,
    input.emergencyAlarm,
  ];
  const facilities = pct(countTrue(flags), flags.length);

  const criticalAssistance = [
    "Contact emergency services",
    "First aid",
    "Allow person to wait inside",
  ];
  const matched = criticalAssistance.filter((option) =>
    input.assistanceOptions.includes(option),
  ).length;
  const assistance = pct(matched, criticalAssistance.length);

  return Math.round(facilities * 0.6 + assistance * 0.4);
}

export function calculateTrustScore(input: TrustScoreInput): TrustScoreBreakdown {
  const verification = verificationScore(input);

  // A Trust Score only exists for a verified Safe Haven. Un-verified,
  // rejected and suspended records score zero regardless of what they claim,
  // so a self-reported facility list can never earn trust on its own.
  if (verification === 0) {
    return {
      total: 0,
      verification: 0,
      operatingInfo: operatingInfoScore(input),
      staffing: staffingScore(input),
      safetyFacilities: safetyFacilitiesScore(input),
      accessibility: accessibilityScore(input),
      emergencySupport: emergencySupportScore(input),
    };
  }

  const operatingInfo = operatingInfoScore(input);
  const staffing = staffingScore(input);
  const safetyFacilities = safetyFacilitiesScore(input);
  const accessibility = accessibilityScore(input);
  const emergencySupport = emergencySupportScore(input);

  const total = Math.round(
    verification * TRUST_WEIGHTS.verification +
      operatingInfo * TRUST_WEIGHTS.operatingInfo +
      staffing * TRUST_WEIGHTS.staffing +
      safetyFacilities * TRUST_WEIGHTS.safetyFacilities +
      accessibility * TRUST_WEIGHTS.accessibility +
      emergencySupport * TRUST_WEIGHTS.emergencySupport,
  );

  return {
    total: Math.min(100, Math.max(0, total)),
    verification,
    operatingInfo,
    staffing,
    safetyFacilities,
    accessibility,
    emergencySupport,
  };
}
