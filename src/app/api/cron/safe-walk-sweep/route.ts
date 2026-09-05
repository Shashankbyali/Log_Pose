import { NextResponse, type NextRequest } from "next/server";
import { escalateOverdueWalks } from "@/lib/safeWalks";

/**
 * Server-side Safe Walk sweep, run by Vercel Cron once a minute.
 *
 * This is what makes an arrival deadline meaningful: it fires even when the
 * user's tab is closed, their phone is asleep, or their battery is dead --
 * exactly the situations a browser timer would silently fail in, and exactly
 * the situations where someone not arriving matters most.
 *
 * The sweep also purges resolved walks, so location data does not accumulate.
 */

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Vercel Cron sends a bearer token matching `CRON_SECRET`. When the secret is
 * configured the route refuses anything else, so the sweep cannot be driven
 * by outside traffic.
 */
function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { escalated, error } = await escalateOverdueWalks();

  if (error) {
    return NextResponse.json({ error, escalated: 0 }, { status: 503 });
  }

  return NextResponse.json({
    escalated: escalated.length,
    walks: escalated.map((walk) => ({
      id: walk.id,
      destinationName: walk.destinationName,
      destinationKind: walk.destinationKind,
      expectedArrivalAt: walk.expectedArrivalAt,
    })),
  });
}
