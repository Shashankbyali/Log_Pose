import { resolveOpenState, type ClockNow } from "./openingHours";
import { getSupabaseClient, getSupabaseServiceClient } from "./supabase";
import type {
  OpenState,
  SafeHavenApplication,
  VerificationStatus,
  VerifiedSafeHaven,
} from "./types";

/**
 * The LOG POSE verified Safe Haven network.
 *
 * A Safe Haven only appears here after the business applied, was reviewed,
 * passed a physical field verification and was approved by an admin.
 * OpenStreetMap establishments are never promoted into this list.
 *
 * Returning `null` means "network data unavailable" (Supabase not configured
 * or unreachable). Returning `[]` means "no verified Safe Havens here" -- a
 * real answer. These are never substituted with mock records in Live Mode.
 */

export interface SafeHavenNetworkResult {
  havens: VerifiedSafeHaven[] | null;
  warning: string | null;
}

type Row = Record<string, unknown>;

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function openStateOf(row: Row, now?: ClockNow): OpenState {
  if (bool(row.is_24_7)) return "open";
  return resolveOpenState(str(row.opening_hours) || null, now);
}

export function mapVerifiedSafeHaven(row: Row, now?: ClockNow): VerifiedSafeHaven {
  return {
    id: String(row.id),
    name: str(row.name, "Unnamed establishment"),
    type: str(row.type, "Other") as VerifiedSafeHaven["type"],
    description: str(row.description),
    latitude: num(row.latitude) ?? 0,
    longitude: num(row.longitude) ?? 0,
    address: str(row.address),
    city: str(row.city),
    pincode: str(row.pincode),
    openingHours: str(row.opening_hours),
    is247: bool(row.is_24_7),
    openState: openStateOf(row, now),
    staffAvailable: bool(row.staff_available),
    securityAvailable: bool(row.security_available),
    safeRoom: bool(row.safe_room),
    waitingArea: bool(row.waiting_area),
    firstAid: bool(row.first_aid),
    cctv: bool(row.cctv),
    emergencyExit: bool(row.emergency_exit),
    wheelchairAccessible: bool(row.wheelchair_accessible),
    accessibleEntrance: bool(row.accessible_entrance),
    accessibleRestroom: bool(row.accessible_restroom),
    assistanceOptions: Array.isArray(row.assistance_options)
      ? (row.assistance_options as unknown[]).map(String)
      : [],
    trustScore: num(row.trust_score) ?? 0,
    verificationStatus: str(row.verification_status, "pending") as VerificationStatus,
    verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
  };
}

export function mapSafeHavenApplication(
  row: Row,
  now?: ClockNow,
): SafeHavenApplication {
  return {
    ...mapVerifiedSafeHaven(row, now),
    phone: str(row.phone),
    employeeCount: num(row.employee_count),
    securityHours: typeof row.security_hours === "string" ? row.security_hours : null,
    femaleStaffAvailable: bool(row.female_staff_available),
    restroom: bool(row.restroom),
    seating: bool(row.seating),
    temporaryShelter: bool(row.temporary_shelter),
    fireExtinguisher: bool(row.fire_extinguisher),
    emergencyAlarm: bool(row.emergency_alarm),
    elevator: bool(row.elevator),
    staffAssistance: bool(row.staff_assistance),
    assignedVerifier:
      typeof row.assigned_verifier === "string" ? row.assigned_verifier : null,
    verificationNotes:
      typeof row.verification_notes === "string" ? row.verification_notes : null,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

/** Columns exposed publicly. Contact details stay out of the public payload. */
const PUBLIC_COLUMNS = [
  "id",
  "name",
  "type",
  "description",
  "latitude",
  "longitude",
  "address",
  "city",
  "pincode",
  "opening_hours",
  "is_24_7",
  "staff_available",
  "security_available",
  "safe_room",
  "waiting_area",
  "first_aid",
  "cctv",
  "emergency_exit",
  "wheelchair_accessible",
  "accessible_entrance",
  "accessible_restroom",
  "assistance_options",
  "trust_score",
  "verification_status",
  "verified_at",
].join(",");

/**
 * Verified Safe Havens, optionally limited to a bounding box around a trip.
 * Never falls back to mock data.
 */
export async function getVerifiedSafeHavens(
  bounds?: { south: number; west: number; north: number; east: number },
  now?: ClockNow,
): Promise<SafeHavenNetworkResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      havens: null,
      warning:
        "Safe Haven network is not configured, so Safe Haven availability is unavailable.",
    };
  }

  try {
    let query = supabase
      .from("safe_havens")
      .select(PUBLIC_COLUMNS)
      .eq("verification_status", "verified");

    if (bounds) {
      query = query
        .gte("latitude", bounds.south)
        .lte("latitude", bounds.north)
        .gte("longitude", bounds.west)
        .lte("longitude", bounds.east);
    }

    const { data, error } = await query.limit(500);
    if (error) {
      return {
        havens: null,
        warning: "Safe Haven network could not be reached, so Safe Haven availability is unavailable.",
      };
    }

    return {
      havens: (data ?? []).map((row) =>
        mapVerifiedSafeHaven(row as unknown as Row, now),
      ),
      warning: null,
    };
  } catch {
    return {
      havens: null,
      warning: "Safe Haven network could not be reached, so Safe Haven availability is unavailable.",
    };
  }
}

/** All applications, for the admin dashboard. Server-side only. */
export async function getSafeHavenApplications(
  status?: VerificationStatus,
): Promise<{ applications: SafeHavenApplication[] | null; error: string | null }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return {
      applications: null,
      error: "Supabase service role is not configured.",
    };
  }

  let query = supabase
    .from("safe_havens")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("verification_status", status);

  const { data, error } = await query.limit(500);
  if (error) return { applications: null, error: error.message };

  return {
    applications: (data ?? []).map((row) => mapSafeHavenApplication(row as Row)),
    error: null,
  };
}

export { rankSafePlaces } from "./safePlaceRanking";
