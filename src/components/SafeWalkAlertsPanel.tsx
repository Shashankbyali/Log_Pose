"use client";

import { useEffect, useState } from "react";
import { ADMIN_TOKEN_HEADER } from "@/lib/constants";
import { formatDistance, haversineMeters } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { SafeWalk, SafeWalkAlert } from "@/lib/types";

/**
 * Overdue Safe Walk alerts.
 *
 * This dashboard is the ONLY escalation channel LOG POSE delivers end to end,
 * so it has to be watched by a human for the feature to mean anything. It
 * polls rather than waiting for a page reload, and overdue walks are pinned
 * to the top.
 */

const POLL_MS = 30000;

interface SafeWalkAlertsPanelProps {
  token: string;
}

interface Payload {
  walks: SafeWalk[];
  alerts: SafeWalkAlert[];
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; payload: Payload }
  | { kind: "error"; message: string };

function minutesLate(walk: SafeWalk): number {
  const due = new Date(walk.expectedArrivalAt).getTime();
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.round((Date.now() - due) / 60000));
}

function WalkCard({ walk, alerts }: { walk: SafeWalk; alerts: SafeWalkAlert[] }) {
  const overdue = walk.status === "overdue";
  const late = minutesLate(walk);

  return (
    <li
      className={cn(
        "rounded-2xl border p-4",
        overdue
          ? "border-rose-400/40 bg-rose-500/10"
          : "border-white/10 bg-white/[0.02]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              overdue
                ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
                : "border-teal-400/30 bg-teal-400/10 text-teal-300",
            )}
          >
            {overdue ? `Overdue by ${late} min` : "In progress"}
          </span>
          <p className="mt-2 font-medium text-white">{walk.destinationName}</p>
          <p className="text-xs text-zinc-400">
            {walk.destinationKind === "verified_haven"
              ? "Verified Safe Haven"
              : "Unverified OpenStreetMap place \u2014 no contact details held"}
          </p>
        </div>
        <p className="shrink-0 text-[11px] text-zinc-500">
          Due {new Date(walk.expectedArrivalAt).toLocaleTimeString()}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-zinc-500">Set out from</dt>
          <dd className="text-zinc-300">
            <a
              href={`https://www.openstreetmap.org/?mlat=${walk.originLat}&mlon=${walk.originLng}#map=17/${walk.originLat}/${walk.originLng}`}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/20 hover:decoration-white"
            >
              {walk.originLat.toFixed(5)}, {walk.originLng.toFixed(5)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Heading to</dt>
          <dd className="text-zinc-300">
            <a
              href={`https://www.openstreetmap.org/?mlat=${walk.destinationLat}&mlon=${walk.destinationLng}#map=17/${walk.destinationLat}/${walk.destinationLng}`}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/20 hover:decoration-white"
            >
              {walk.destinationLat.toFixed(5)}, {walk.destinationLng.toFixed(5)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Route length</dt>
          <dd className="text-zinc-300">
            {formatDistance(
              haversineMeters(
                { lat: walk.originLat, lng: walk.originLng },
                { lat: walk.destinationLat, lng: walk.destinationLng },
              ),
            )}{" "}
            direct
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Nearest police station</dt>
          <dd className="text-zinc-300">
            {walk.police
              ? `${walk.police.name}${walk.police.phone ? ` \u00b7 ${walk.police.phone}` : " \u00b7 no number mapped"}`
              : "None mapped nearby"}
          </dd>
        </div>
      </dl>

      {alerts.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-white/10 pt-2.5">
          {alerts.map((alert) => (
            <li key={alert.id} className="text-[11px] leading-relaxed text-zinc-400">
              <span className="text-zinc-500">
                {new Date(alert.createdAt).toLocaleTimeString()} &middot;{" "}
                {alert.channel}
              </span>{" "}
              {alert.detail}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function SafeWalkAlertsPanel({ token }: SafeWalkAlertsPanelProps) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/admin/safe-walks", {
          headers: { [ADMIN_TOKEN_HEADER]: token },
        });
        const data = (await response.json()) as Partial<Payload> & {
          error?: string;
        };

        if (cancelled) return;

        if (!response.ok) {
          setState({
            kind: "error",
            message: data.error ?? "Safe Walks could not be loaded.",
          });
          return;
        }

        setState({
          kind: "ready",
          payload: { walks: data.walks ?? [], alerts: data.alerts ?? [] },
        });
      } catch {
        if (!cancelled) {
          setState({ kind: "error", message: "Could not reach the server." });
        }
      }
    };

    void load();
    const timer = setInterval(() => void load(), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  const walks = state.kind === "ready" ? state.payload.walks : [];
  const overdueCount = walks.filter((walk) => walk.status === "overdue").length;

  // Overdue first, then soonest due.
  const sorted = [...walks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "overdue" ? -1 : 1;
    return a.expectedArrivalAt.localeCompare(b.expectedArrivalAt);
  });

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        overdueCount > 0
          ? "border-rose-400/40 bg-rose-500/[0.07]"
          : "border-white/10 bg-white/[0.02]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Safe Walk alerts</h2>
          <p className="text-[11px] text-zinc-500">
            People who asked LOG POSE to watch for their arrival. Refreshes every
            30 seconds.
          </p>
        </div>
        {overdueCount > 0 && (
          <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-200">
            {overdueCount} overdue
          </span>
        )}
      </div>

      <div className="mt-3">
        {state.kind === "loading" && (
          <p className="text-xs text-zinc-500">Loading Safe Walks...</p>
        )}

        {state.kind === "error" && (
          <p className="rounded-xl border border-amber-400/25 bg-amber-400/8 px-3.5 py-2.5 text-xs leading-relaxed text-amber-200/90">
            {state.message} Nobody is watching arrival deadlines while this is
            failing.
          </p>
        )}

        {state.kind === "ready" && sorted.length === 0 && (
          <p className="text-xs text-zinc-500">No Safe Walks in progress.</p>
        )}

        {state.kind === "ready" && sorted.length > 0 && (
          <ul className="space-y-2.5">
            {sorted.map((walk) => (
              <WalkCard
                key={walk.id}
                walk={walk}
                alerts={state.payload.alerts.filter(
                  (alert) => alert.safeWalkId === walk.id,
                )}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 border-t border-white/10 pt-2.5 text-[11px] leading-relaxed text-zinc-600">
        LOG POSE does not contact the police. An overdue walk requires a human
        here to act on it.
      </p>
    </section>
  );
}
