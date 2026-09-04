import { NextResponse } from "next/server";
import { ADMIN_TOKEN_HEADER } from "./constants";

/**
 * Admin authentication for the LOG POSE verification dashboard.
 *
 * A single shared admin token is kept in the server-only `ADMIN_TOKEN`
 * environment variable and compared in constant time. The token is never sent
 * to the client bundle; the dashboard holds it only in memory for the session.
 */

export { ADMIN_TOKEN_HEADER };

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN);
}

/** Returns an error response when the request is not an authorised admin. */
export function requireAdmin(request: Request): NextResponse | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Admin access is not configured on this deployment." },
      { status: 503 },
    );
  }

  const provided = request.headers.get(ADMIN_TOKEN_HEADER) ?? "";
  if (!provided || !constantTimeEquals(provided, expected)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  return null;
}
