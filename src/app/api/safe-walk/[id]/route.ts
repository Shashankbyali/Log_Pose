import { NextResponse, type NextRequest } from "next/server";
import { resolveSafeWalk } from "@/lib/safeWalks";

/**
 * Stands a Safe Walk down: the user confirms they arrived, or cancels.
 *
 * Authorised by the per-walk device token issued when the walk started, so
 * only the phone that raised the deadline can clear it, with no account and
 * nothing identifying stored.
 */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deviceToken, outcome } = (body ?? {}) as Record<string, unknown>;

  if (typeof deviceToken !== "string" || deviceToken.length === 0) {
    return NextResponse.json({ error: "A device token is required" }, { status: 400 });
  }

  if (outcome !== "arrived" && outcome !== "cancelled") {
    return NextResponse.json({ error: "Unknown outcome" }, { status: 400 });
  }

  const { walk, error, status } = await resolveSafeWalk(id, deviceToken, outcome);

  if (!walk) {
    return NextResponse.json({ error: error ?? "Could not update" }, { status });
  }

  return NextResponse.json({ walk });
}
