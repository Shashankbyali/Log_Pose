import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { mapSafeHavenApplication } from "@/lib/safeHavens";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { calculateTrustScore, type TrustScoreInput } from "@/lib/trustScore";
import type { VerificationStatus } from "@/lib/types";

/**
 * Safe Haven verification workflow transitions. Admin only.
 *
 *   pending -> under_review -> field_verification -> verified | rejected
 *   verified -> suspended
 *
 * Approval is blocked until a physical field verification has been recorded,
 * which is what makes the LOG POSE Safe Haven designation meaningful.
 * The Trust Score is recomputed from the verified record on approval; it is
 * never supplied by the applicant or typed in by an admin.
 */

type Action =
  | "start_review"
  | "assign_verifier"
  | "record_verification"
  | "approve"
  | "reject"
  | "suspend"
  | "reinstate"
  | "update_details";

type Row = Record<string, unknown>;

const DETAIL_FIELDS = [
  "name",
  "type",
  "description",
  "address",
  "city",
  "pincode",
  "opening_hours",
  "is_24_7",
  "employee_count",
  "staff_available",
  "security_available",
  "security_hours",
  "female_staff_available",
  "safe_room",
  "waiting_area",
  "seating",
  "restroom",
  "temporary_shelter",
  "staff_assistance",
  "first_aid",
  "cctv",
  "emergency_exit",
  "fire_extinguisher",
  "emergency_alarm",
  "wheelchair_accessible",
  "accessible_entrance",
  "accessible_restroom",
  "elevator",
  "assistance_options",
] as const;

function trustInputFrom(row: Row, status: VerificationStatus): TrustScoreInput {
  const bool = (key: string) => row[key] === true;
  const text = (key: string) =>
    typeof row[key] === "string" ? (row[key] as string) : null;

  return {
    verificationStatus: status,
    fieldVerificationCompleted: bool("field_verification_completed"),
    verificationNotes: text("verification_notes"),
    phone: text("phone"),
    address: text("address"),
    openingHours: text("opening_hours"),
    is247: bool("is_24_7"),
    employeeCount:
      typeof row.employee_count === "number" ? row.employee_count : null,
    staffAvailable: bool("staff_available"),
    securityAvailable: bool("security_available"),
    securityHours: text("security_hours"),
    femaleStaffAvailable: bool("female_staff_available"),
    safeRoom: bool("safe_room"),
    waitingArea: bool("waiting_area"),
    seating: bool("seating"),
    restroom: bool("restroom"),
    temporaryShelter: bool("temporary_shelter"),
    staffAssistance: bool("staff_assistance"),
    firstAid: bool("first_aid"),
    cctv: bool("cctv"),
    emergencyExit: bool("emergency_exit"),
    fireExtinguisher: bool("fire_extinguisher"),
    emergencyAlarm: bool("emergency_alarm"),
    wheelchairAccessible: bool("wheelchair_accessible"),
    accessibleEntrance: bool("accessible_entrance"),
    accessibleRestroom: bool("accessible_restroom"),
    elevator: bool("elevator"),
    assistanceOptions: Array.isArray(row.assistance_options)
      ? (row.assistance_options as unknown[]).map(String)
      : [],
  };
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/admin/applications/[id]">,
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 503 },
    );
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body.action as Action | undefined;
  if (!action) {
    return NextResponse.json({ error: "An action is required" }, { status: 400 });
  }

  const { data: existing, error: readError } = await supabase
    .from("safe_havens")
    .select("*")
    .eq("id", id)
    .single();

  if (readError || !existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const row = existing as Row;
  const updates: Row = { updated_at: new Date().toISOString() };
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  switch (action) {
    case "start_review":
      updates.verification_status = "under_review";
      break;

    case "assign_verifier": {
      const verifier = typeof body.verifier === "string" ? body.verifier.trim() : "";
      if (verifier.length < 2) {
        return NextResponse.json(
          { error: "A verification employee name is required" },
          { status: 422 },
        );
      }
      updates.assigned_verifier = verifier;
      updates.verification_status = "field_verification";
      break;
    }

    case "record_verification": {
      if (!notes || notes.length < 20) {
        return NextResponse.json(
          { error: "Record a verification report of at least 20 characters" },
          { status: 422 },
        );
      }
      updates.verification_notes = notes;
      updates.field_verification_completed = body.fieldVerified === true;
      updates.field_verified_at = new Date().toISOString();
      updates.verification_status = "field_verification";
      break;
    }

    case "approve": {
      if (row.field_verification_completed !== true) {
        return NextResponse.json(
          {
            error:
              "A completed physical verification visit must be recorded before approval.",
          },
          { status: 409 },
        );
      }
      updates.verification_status = "verified";
      updates.verified_at = new Date().toISOString();
      updates.trust_score = calculateTrustScore(
        trustInputFrom(row, "verified"),
      ).total;
      break;
    }

    case "reject":
      if (!notes) {
        return NextResponse.json(
          { error: "A rejection reason is required" },
          { status: 422 },
        );
      }
      updates.verification_status = "rejected";
      updates.verification_notes = notes;
      updates.trust_score = 0;
      updates.verified_at = null;
      break;

    case "suspend":
      if (!notes) {
        return NextResponse.json(
          { error: "A suspension reason is required" },
          { status: 422 },
        );
      }
      updates.verification_status = "suspended";
      updates.verification_notes = notes;
      updates.trust_score = 0;
      break;

    case "reinstate": {
      if (row.field_verification_completed !== true) {
        return NextResponse.json(
          { error: "Re-verify this establishment before reinstating it." },
          { status: 409 },
        );
      }
      updates.verification_status = "verified";
      updates.trust_score = calculateTrustScore(
        trustInputFrom(row, "verified"),
      ).total;
      break;
    }

    case "update_details": {
      const details = (body.details ?? {}) as Row;
      for (const field of DETAIL_FIELDS) {
        if (field in details) updates[field] = details[field];
      }
      if (Object.keys(updates).length === 1) {
        return NextResponse.json(
          { error: "No editable fields were provided" },
          { status: 422 },
        );
      }
      // Verified establishments keep an accurate Trust Score after edits.
      if (row.verification_status === "verified") {
        updates.trust_score = calculateTrustScore(
          trustInputFrom({ ...row, ...updates }, "verified"),
        ).total;
      }
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("safe_havens")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not update the application" },
      { status: 502 },
    );
  }

  return NextResponse.json({ application: mapSafeHavenApplication(data as Row) });
}
