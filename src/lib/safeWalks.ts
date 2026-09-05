import { randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceClient } from "./supabase";
import type {
  LatLng,
  PoliceStationSnapshot,
  SafeWalk,
  SafeWalkAlert,
  SafeWalkAlertChannel,
  SafeWalkDestinationKind,
} from "./types";

/**
 * Safe Walk data access. Server-only: every call uses the service-role key,
 * because RLS deliberately grants clients no direct access to these rows.
 *
 * Returning `null` means "unavailable" (Supabase not configured or
 * unreachable). Callers must surface that honestly -- a Safe Walk that was
 * not actually recorded must never be presented as active, because the user
 * would then be relying on a deadline nobody is watching.
 */

type Row = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createDeviceToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Constant-time comparison, so a token cannot be discovered by timing. */
export function deviceTokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function policeOf(row: Row): PoliceStationSnapshot | null {
  const name = str(row.police_name);
  const lat = num(row.police_lat);
  const lng = num(row.police_lng);
  if (!name || lat === null || lng === null) return null;
  return {
    name,
    lat,
    lng,
    phone: typeof row.police_phone === "string" ? row.police_phone : null,
  };
}

/** Maps a row to the public shape. Deliberately omits `device_token`. */
export function mapSafeWalk(row: Row): SafeWalk {
  return {
    id: String(row.id),
    destinationName: str(row.destination_name, "Unnamed place"),
    destinationKind: str(
      row.destination_kind,
      "osm_place",
    ) as SafeWalkDestinationKind,
    destinationLat: num(row.destination_lat) ?? 0,
    destinationLng: num(row.destination_lng) ?? 0,
    originLat: num(row.origin_lat) ?? 0,
    originLng: num(row.origin_lng) ?? 0,
    expectedWalkSeconds: num(row.expected_walk_seconds) ?? 0,
    graceSeconds: num(row.grace_seconds) ?? 0,
    expectedArrivalAt: str(row.expected_arrival_at),
    status: str(row.status, "active") as SafeWalk["status"],
    createdAt: str(row.created_at),
    arrivedAt: typeof row.arrived_at === "string" ? row.arrived_at : null,
    overdueAt: typeof row.overdue_at === "string" ? row.overdue_at : null,
    police: policeOf(row),
  };
}

export interface StartSafeWalkInput {
  origin: LatLng;
  destination: LatLng;
  destinationName: string;
  destinationKind: SafeWalkDestinationKind;
  safeHavenId: string | null;
  expectedWalkSeconds: number;
  graceSeconds: number;
  police: PoliceStationSnapshot | null;
}

export interface StartSafeWalkResult {
  walk: SafeWalk;
  /** Returned to the originating device once, and never listed again. */
  deviceToken: string;
}

export async function startSafeWalk(
  input: StartSafeWalkInput,
): Promise<{ result: StartSafeWalkResult | null; error: string | null }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return {
      result: null,
      error:
        "Safe Walk is not configured on this deployment, so no arrival deadline can be recorded.",
    };
  }

  const deviceToken = createDeviceToken();
  const expectedArrivalAt = new Date(
    Date.now() + (input.expectedWalkSeconds + input.graceSeconds) * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("safe_walks")
    .insert({
      device_token: deviceToken,
      origin_lat: input.origin.lat,
      origin_lng: input.origin.lng,
      destination_lat: input.destination.lat,
      destination_lng: input.destination.lng,
      destination_name: input.destinationName,
      destination_kind: input.destinationKind,
      safe_haven_id: input.safeHavenId,
      expected_walk_seconds: input.expectedWalkSeconds,
      grace_seconds: input.graceSeconds,
      expected_arrival_at: expectedArrivalAt,
      police_name: input.police?.name ?? null,
      police_lat: input.police?.lat ?? null,
      police_lng: input.police?.lng ?? null,
      police_phone: input.police?.phone ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      result: null,
      error: "The Safe Walk could not be recorded, so no deadline is being watched.",
    };
  }

  return {
    result: { walk: mapSafeWalk(data as Row), deviceToken },
    error: null,
  };
}

/**
 * Resolves a walk to 'arrived' or 'cancelled'. Requires the device token, so
 * only the phone that started the walk can stand it down.
 */
export async function resolveSafeWalk(
  id: string,
  deviceToken: string,
  outcome: "arrived" | "cancelled",
): Promise<{ walk: SafeWalk | null; error: string | null; status: number }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { walk: null, error: "Safe Walk is not configured.", status: 503 };
  }

  const { data: existing, error: readError } = await supabase
    .from("safe_walks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return { walk: null, error: "Could not read the Safe Walk.", status: 503 };
  }
  if (!existing) {
    return { walk: null, error: "Safe Walk not found.", status: 404 };
  }

  const row = existing as Row;
  if (!deviceTokenMatches(deviceToken, str(row.device_token))) {
    return { walk: null, error: "Not authorised.", status: 401 };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("safe_walks")
    .update({
      status: outcome,
      arrived_at: outcome === "arrived" ? now : null,
      cancelled_at: outcome === "cancelled" ? now : null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return { walk: null, error: "Could not update the Safe Walk.", status: 503 };
  }

  return { walk: mapSafeWalk(data as Row), error: null, status: 200 };
}

/**
 * Marks every active walk whose deadline has passed as overdue and records a
 * dashboard alert for each. Idempotent: `escalated_at` guarantees a walk is
 * only escalated once, however often the sweep runs.
 */
export async function escalateOverdueWalks(): Promise<{
  escalated: SafeWalk[];
  error: string | null;
}> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { escalated: [], error: "Safe Walk is not configured." };

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("safe_walks")
    .update({ status: "overdue", overdue_at: now, escalated_at: now })
    .eq("status", "active")
    .is("escalated_at", null)
    .lt("expected_arrival_at", now)
    .select("*");

  if (error) return { escalated: [], error: "Could not sweep Safe Walks." };

  const walks = (data ?? []).map((row) => mapSafeWalk(row as Row));

  if (walks.length > 0) {
    // One honest record per walk of what was actually delivered. The
    // dashboard is the only channel LOG POSE controls end to end.
    await supabase.from("safe_walk_alerts").insert(
      walks.map((walk) => ({
        safe_walk_id: walk.id,
        channel: "dashboard" as SafeWalkAlertChannel,
        detail:
          walk.destinationKind === "verified_haven"
            ? `Overdue arrival at verified Safe Haven "${walk.destinationName}". Raised on the LOG POSE admin dashboard for a human to action.`
            : `Overdue arrival at unverified OpenStreetMap place "${walk.destinationName}". LOG POSE holds no contact details for this establishment.`,
      })),
    );
  }

  await supabase.rpc("purge_expired_safe_walks");

  return { escalated: walks, error: null };
}

/** Active and overdue walks for the admin dashboard. Never exposes tokens. */
export async function getOpenSafeWalks(): Promise<{
  walks: SafeWalk[] | null;
  alerts: SafeWalkAlert[] | null;
  error: string | null;
}> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { walks: null, alerts: null, error: "Safe Walk is not configured." };
  }

  const { data, error } = await supabase
    .from("safe_walks")
    .select("*")
    .in("status", ["active", "overdue"])
    .order("expected_arrival_at", { ascending: true })
    .limit(200);

  if (error) return { walks: null, alerts: null, error: "Could not read Safe Walks." };

  const walks = (data ?? []).map((row) => mapSafeWalk(row as Row));
  if (walks.length === 0) return { walks, alerts: [], error: null };

  const { data: alertRows } = await supabase
    .from("safe_walk_alerts")
    .select("*")
    .in(
      "safe_walk_id",
      walks.map((walk) => walk.id),
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const alerts: SafeWalkAlert[] = (alertRows ?? []).map((row) => {
    const alert = row as Row;
    return {
      id: String(alert.id),
      safeWalkId: String(alert.safe_walk_id),
      channel: str(alert.channel, "dashboard") as SafeWalkAlertChannel,
      detail: str(alert.detail),
      createdAt: str(alert.created_at),
    };
  });

  return { walks, alerts, error: null };
}
