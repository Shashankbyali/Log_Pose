import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getOpenSafeWalks } from "@/lib/safeWalks";

/**
 * Active and overdue Safe Walks for the admin dashboard.
 *
 * This is the one escalation channel LOG POSE controls end to end, so it is
 * the channel the UI is allowed to promise. Device tokens are never included
 * in the payload.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { walks, alerts, error } = await getOpenSafeWalks();

  if (walks === null) {
    return NextResponse.json(
      { error: error ?? "Safe Walks are unavailable." },
      { status: 503 },
    );
  }

  return NextResponse.json({ walks, alerts: alerts ?? [] });
}
