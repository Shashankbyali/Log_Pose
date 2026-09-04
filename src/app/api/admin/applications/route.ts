import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSafeHavenApplications } from "@/lib/safeHavens";
import { VERIFICATION_STATUSES, type VerificationStatus } from "@/lib/types";

/** Safe Haven applications across every verification stage. Admin only. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam && VERIFICATION_STATUSES.includes(statusParam as VerificationStatus)
      ? (statusParam as VerificationStatus)
      : undefined;

  const { applications, error } = await getSafeHavenApplications(status);
  if (applications === null) {
    return NextResponse.json({ error }, { status: 503 });
  }

  const counts = VERIFICATION_STATUSES.reduce<Record<string, number>>(
    (acc, value) => ({ ...acc, [value]: 0 }),
    {},
  );

  if (!status) {
    for (const application of applications) {
      counts[application.verificationStatus] =
        (counts[application.verificationStatus] ?? 0) + 1;
    }
  }

  return NextResponse.json({ applications, counts: status ? null : counts });
}
