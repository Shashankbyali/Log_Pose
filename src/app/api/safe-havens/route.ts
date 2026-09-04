import { NextResponse, type NextRequest } from "next/server";
import { nowInTimeZone } from "@/lib/openingHours";
import {
  EMPTY_APPLICATION,
  toSafeHavenRow,
  validateApplication,
  type SafeHavenApplicationInput,
} from "@/lib/safeHavenApplication";
import { getVerifiedSafeHavens } from "@/lib/safeHavens";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * GET  -> verified LOG POSE Safe Havens (public).
 * POST -> submit a Safe Haven application.
 *
 * A submitted application is stored with `verification_status = 'pending'`.
 * The status is forced server-side (and again by a database trigger), so a
 * client can never self-verify or set its own Trust Score.
 */

function coerce(body: Record<string, unknown>): SafeHavenApplicationInput {
  const text = (key: keyof SafeHavenApplicationInput) => {
    const value = body[key];
    return typeof value === "string" ? value : "";
  };
  const flag = (key: keyof SafeHavenApplicationInput) => body[key] === true;
  const number = (key: keyof SafeHavenApplicationInput) => {
    const value = body[key];
    if (value === null || value === undefined || value === "") return Number.NaN;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const employeeCountRaw = body.employeeCount;
  const employeeCount =
    employeeCountRaw === null || employeeCountRaw === undefined || employeeCountRaw === ""
      ? null
      : Number(employeeCountRaw);

  return {
    ...EMPTY_APPLICATION,
    name: text("name"),
    type: (text("type") || EMPTY_APPLICATION.type) as SafeHavenApplicationInput["type"],
    description: text("description"),
    address: text("address"),
    city: text("city"),
    pincode: text("pincode"),
    phone: text("phone"),
    latitude: number("latitude"),
    longitude: number("longitude"),

    openingHours: text("openingHours"),
    is247: flag("is247"),
    employeeCount: Number.isFinite(employeeCount) ? (employeeCount as number) : null,
    staffAvailable: flag("staffAvailable"),
    securityAvailable: flag("securityAvailable"),
    securityHours: text("securityHours"),
    femaleStaffAvailable: flag("femaleStaffAvailable"),

    safeRoom: flag("safeRoom"),
    waitingArea: flag("waitingArea"),
    seating: flag("seating"),
    restroom: flag("restroom"),
    temporaryShelter: flag("temporaryShelter"),
    staffAssistance: flag("staffAssistance"),

    firstAid: flag("firstAid"),
    cctv: flag("cctv"),
    emergencyExit: flag("emergencyExit"),
    fireExtinguisher: flag("fireExtinguisher"),
    emergencyAlarm: flag("emergencyAlarm"),

    wheelchairAccessible: flag("wheelchairAccessible"),
    accessibleEntrance: flag("accessibleEntrance"),
    accessibleRestroom: flag("accessibleRestroom"),
    elevator: flag("elevator"),

    assistanceOptions: Array.isArray(body.assistanceOptions)
      ? body.assistanceOptions.filter((v): v is string => typeof v === "string")
      : [],
    contactPersonName: text("contactPersonName"),
    contactPersonPhone: text("contactPersonPhone"),
    consentToVerification: flag("consentToVerification"),
  };
}

export async function GET() {
  const result = await getVerifiedSafeHavens(undefined, nowInTimeZone());

  if (result.havens === null) {
    return NextResponse.json(
      { error: result.warning, safeHavens: [] },
      { status: 503 },
    );
  }

  return NextResponse.json({ safeHavens: result.havens });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Safe Haven registration is not available because the LOG POSE database is not configured.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const input = coerce((body ?? {}) as Record<string, unknown>);
  const errors = validateApplication(input);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Please correct the highlighted fields", fieldErrors: errors },
      { status: 422 },
    );
  }

  const { data, error } = await supabase
    .from("safe_havens")
    .insert(toSafeHavenRow(input))
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not submit the application. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      id: data.id,
      status: "pending",
      message:
        "Application received. Our team will review it and schedule a physical verification visit before any LOG POSE Safe Haven designation is granted.",
    },
    { status: 201 },
  );
}
