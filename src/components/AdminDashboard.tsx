"use client";

import { useCallback, useState } from "react";
import { SafeWalkAlertsPanel } from "./SafeWalkAlertsPanel";
import { ADMIN_TOKEN_HEADER } from "@/lib/constants";
import { describeOpenState } from "@/lib/openingHours";
import { VERIFICATION_STATUSES, type SafeHavenApplication, type VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  field_verification: "Field verification",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

const STATUS_STYLES: Record<VerificationStatus, string> = {
  pending: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  under_review: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  field_verification: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  verified: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  rejected: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  suspended: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

const VERIFICATION_CHECKLIST = [
  "Establishment exists at the stated location",
  "Location coordinates are correct",
  "Business identity confirmed",
  "Operating hours confirmed",
  "Staff availability confirmed",
  "Security availability confirmed",
  "Claimed safe-space facilities present",
  "Emergency facilities present",
  "Accessibility claims accurate",
  "Willing and able to assist someone seeking temporary safety",
];

function StatusChip({ status }: { status: VerificationStatus }) {
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AdminDashboard() {
  const [token, setToken] = useState("");
  const [authorised, setAuthorised] = useState(false);
  const [applications, setApplications] = useState<SafeHavenApplication[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [filter, setFilter] = useState<VerificationStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [verifier, setVerifier] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);

  const load = useCallback(
    async (adminToken: string, status: VerificationStatus | "all") => {
      setLoading(true);
      setError(null);

      try {
        const query = status === "all" ? "" : `?status=${status}`;
        const response = await fetch(`/api/admin/applications${query}`, {
          headers: { [ADMIN_TOKEN_HEADER]: adminToken },
        });
        const data = (await response.json()) as {
          applications?: SafeHavenApplication[];
          counts?: Record<string, number> | null;
          error?: string;
        };

        if (!response.ok) {
          setAuthorised(false);
          setError(data.error ?? "Could not load applications.");
          return;
        }

        setAuthorised(true);
        setApplications(data.applications ?? []);
        if (data.counts) setCounts(data.counts);
      } catch {
        setError("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Filter changes reload in the event handler rather than via an effect. */
  const changeFilter = (next: VerificationStatus | "all") => {
    setFilter(next);
    if (authorised && token) void load(token, next);
  };

  const act = async (id: string, body: Record<string, unknown>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [ADMIN_TOKEN_HEADER]: token,
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        application?: SafeHavenApplication;
        error?: string;
      };

      if (!response.ok || !data.application) {
        setError(data.error ?? "The action could not be completed.");
        return;
      }

      const updated = data.application;
      setApplications((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotes("");
      setChecklist([]);
      await load(token, filter);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  if (!authorised) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
        <h1 className="text-base font-semibold text-white">LOG POSE Admin</h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Safe Haven verification dashboard. The admin token is held in memory
          for this session only.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void load(token, filter);
          }}
        >
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Admin token"
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-teal-400/50 focus:outline-none"
          />
          {error && (
            <p className="text-xs text-orange-300" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  const selected = applications.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      {/* Pinned above applications: an overdue walk is time-critical, a
          pending application is not. */}
      <SafeWalkAlertsPanel token={token} />

      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {VERIFICATION_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => changeFilter(status)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                filter === status
                  ? "border-white/25 bg-white/[0.07]"
                  : "border-white/10 bg-zinc-900/50 hover:border-white/20",
              )}
            >
              <p className="text-2xl font-semibold tabular-nums text-white">
                {counts[status] ?? 0}
              </p>
              <p className="text-[11px] text-zinc-500">{STATUS_LABELS[status]}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => changeFilter("all")}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs",
            filter === "all"
              ? "border-white/25 bg-white/10 text-white"
              : "border-white/10 text-zinc-400 hover:bg-white/5",
          )}
        >
          All applications
        </button>
        <button
          type="button"
          onClick={() => void load(token, filter)}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
        >
          Refresh
        </button>
        {loading && <span className="text-xs text-zinc-500">Working...</span>}
      </div>

      {error && (
        <p
          className="rounded-xl border border-orange-400/25 bg-orange-400/10 px-4 py-2.5 text-sm text-orange-200"
          role="alert"
        >
          {error}
        </p>
      )}

      {applications.length === 0 && !loading && (
        <p className="rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-500">
          No applications in this stage.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2">
          {applications.map((application) => (
            <li key={application.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(application.id);
                  setNotes(application.verificationNotes ?? "");
                  setVerifier(application.assignedVerifier ?? "");
                  setChecklist([]);
                }}
                className={cn(
                  "w-full rounded-xl border p-3.5 text-left transition",
                  selectedId === application.id
                    ? "border-white/25 bg-white/[0.07]"
                    : "border-white/10 bg-zinc-900/50 hover:border-white/20",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {application.name}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {application.type} &middot; {application.city}
                    </p>
                  </div>
                  <StatusChip status={application.verificationStatus} />
                </div>
                {application.verificationStatus === "verified" && (
                  <p className="mt-1.5 text-xs text-teal-300">
                    Trust Score {application.trustScore}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 lg:sticky lg:top-4 lg:self-start">
            <div>
              <StatusChip status={selected.verificationStatus} />
              <h2 className="mt-2 text-base font-semibold text-white">
                {selected.name}
              </h2>
              <p className="text-xs text-zinc-400">
                {selected.type} &middot; {selected.address}, {selected.city}{" "}
                {selected.pincode}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {selected.phone} &middot; {selected.latitude.toFixed(5)},{" "}
                {selected.longitude.toFixed(5)}
              </p>
              <a
                href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=18/${selected.latitude}/${selected.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-xs text-teal-400 hover:underline"
              >
                View location on OpenStreetMap
              </a>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <dt className="text-zinc-500">Hours</dt>
                <dd className="text-zinc-200">
                  {selected.is247 ? "24/7" : selected.openingHours || "Not stated"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Currently</dt>
                <dd className="text-zinc-200">
                  {describeOpenState(selected.openState)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Employees</dt>
                <dd className="text-zinc-200">
                  {selected.employeeCount ?? "Not stated"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Security</dt>
                <dd className="text-zinc-200">
                  {selected.securityAvailable
                    ? selected.securityHours ?? "Available"
                    : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Assigned verifier</dt>
                <dd className="text-zinc-200">
                  {selected.assignedVerifier ?? "Not assigned"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Field verified</dt>
                <dd className="text-zinc-200">
                  {selected.verifiedAt ? "Yes" : "Not recorded"}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Claimed assistance
              </p>
              <p className="mt-1 text-xs text-zinc-300">
                {selected.assistanceOptions.join(", ") || "None selected"}
              </p>
            </div>

            <div className="space-y-2.5 border-t border-white/10 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Workflow
              </p>

              {selected.verificationStatus === "pending" && (
                <button
                  type="button"
                  onClick={() => void act(selected.id, { action: "start_review" })}
                  className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-zinc-100 hover:bg-white/5"
                >
                  Start review
                </button>
              )}

              {(selected.verificationStatus === "under_review" ||
                selected.verificationStatus === "field_verification") && (
                <div className="space-y-2">
                  <input
                    value={verifier}
                    onChange={(event) => setVerifier(event.target.value)}
                    placeholder="Verification employee name"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void act(selected.id, { action: "assign_verifier", verifier })
                    }
                    className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-zinc-100 hover:bg-white/5"
                  >
                    Assign for physical verification
                  </button>
                </div>
              )}

              {selected.verificationStatus === "field_verification" && (
                <div className="space-y-2.5 rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    On-site verification checklist
                  </p>
                  <div className="space-y-1.5">
                    {VERIFICATION_CHECKLIST.map((item) => (
                      <label
                        key={item}
                        className="flex gap-2 text-[11px] leading-snug text-zinc-300"
                      >
                        <input
                          type="checkbox"
                          checked={checklist.includes(item)}
                          onChange={() =>
                            setChecklist((previous) =>
                              previous.includes(item)
                                ? previous.filter((value) => value !== item)
                                : [...previous, item],
                            )
                          }
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-teal-500"
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {checklist.length} of {VERIFICATION_CHECKLIST.length} confirmed
                  </p>
                </div>
              )}

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Verification report / decision reason"
                className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />

              {selected.verificationStatus === "field_verification" && (
                <button
                  type="button"
                  onClick={() =>
                    void act(selected.id, {
                      action: "record_verification",
                      notes: `${notes}\n\nConfirmed on site (${checklist.length}/${VERIFICATION_CHECKLIST.length}): ${checklist.join("; ") || "none"}`,
                      fieldVerified: checklist.length === VERIFICATION_CHECKLIST.length,
                    })
                  }
                  className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 py-2.5 text-sm text-amber-200 hover:bg-amber-400/15"
                >
                  Record verification visit
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                {selected.verificationStatus !== "verified" && (
                  <button
                    type="button"
                    onClick={() => void act(selected.id, { action: "approve" })}
                    className="rounded-xl border border-teal-400/30 bg-teal-400/10 py-2.5 text-sm text-teal-200 hover:bg-teal-400/15"
                  >
                    Approve
                  </button>
                )}
                {selected.verificationStatus === "verified" ? (
                  <button
                    type="button"
                    onClick={() => void act(selected.id, { action: "suspend", notes })}
                    className="rounded-xl border border-rose-400/30 bg-rose-400/10 py-2.5 text-sm text-rose-200 hover:bg-rose-400/15"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void act(selected.id, { action: "reject", notes })}
                    className="rounded-xl border border-orange-400/30 bg-orange-400/10 py-2.5 text-sm text-orange-200 hover:bg-orange-400/15"
                  >
                    Reject
                  </button>
                )}
              </div>

              {selected.verificationStatus === "suspended" && (
                <button
                  type="button"
                  onClick={() => void act(selected.id, { action: "reinstate" })}
                  className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-zinc-100 hover:bg-white/5"
                >
                  Reinstate
                </button>
              )}

              <p className="text-[11px] leading-snug text-zinc-600">
                Approval requires a recorded physical verification visit. The
                Trust Score is recalculated automatically from the verified
                record and cannot be entered manually.
              </p>
            </div>

            {selected.verificationNotes && (
              <div className="border-t border-white/10 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Latest report
                </p>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-zinc-400">
                  {selected.verificationNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
