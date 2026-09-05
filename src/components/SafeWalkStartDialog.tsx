"use client";

import { useEffect, useState } from "react";
import {
  saveSafeWalk,
  saveTrustedContact,
  useTrustedContact,
} from "@/lib/safeWalkStore";
import { cn } from "@/lib/utils";
import type { LatLng, SafeWalk, SafeWalkDestinationKind } from "@/lib/types";

export interface SafeWalkRequest {
  origin: LatLng;
  destination: LatLng;
  destinationName: string;
  destinationKind: SafeWalkDestinationKind;
  safeHavenId: string | null;
}

interface SafeWalkStartDialogProps {
  request: SafeWalkRequest;
  onClose: () => void;
}

const GRACE_OPTIONS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "20 min", seconds: 1200 },
];

/**
 * Offers to start a Safe Walk after the user picks a place to walk to.
 *
 * The copy here is deliberately blunt about what will and will not happen.
 * Someone deciding whether to rely on this needs to know that LOG POSE cannot
 * call the police for them, and that the only channel it delivers end to end
 * is its own dashboard.
 */
export function SafeWalkStartDialog({ request, onClose }: SafeWalkStartDialogProps) {
  const storedContact = useTrustedContact();
  const [contact, setContact] = useState(storedContact);
  const [graceSeconds, setGraceSeconds] = useState(600);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const start = async () => {
    setBusy(true);
    setError(null);

    // Kept on this device only, never sent to LOG POSE.
    saveTrustedContact(contact);

    try {
      const response = await fetch("/api/safe-walk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: request.origin,
          destination: request.destination,
          destinationName: request.destinationName,
          destinationKind: request.destinationKind,
          safeHavenId: request.safeHavenId,
          graceSeconds,
        }),
      });

      const data = (await response.json()) as {
        walk?: SafeWalk;
        deviceToken?: string;
        error?: string;
      };

      if (!response.ok || !data.walk || !data.deviceToken) {
        setError(data.error ?? "The Safe Walk could not be started.");
        return;
      }

      saveSafeWalk({
        id: data.walk.id,
        deviceToken: data.deviceToken,
        destinationName: data.walk.destinationName,
        destinationKind: data.walk.destinationKind,
        destinationLat: data.walk.destinationLat,
        destinationLng: data.walk.destinationLng,
        expectedArrivalAt: data.walk.expectedArrivalAt,
        police: data.walk.police,
      });

      onClose();
    } catch {
      setError("Could not reach LOG POSE. No Safe Walk has been started.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Start a Safe Walk"
    >
      <div className="lp-sheet-in lp-glass w-full max-w-md overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Start a Safe Walk?</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Heading to {request.destinationName}
          </p>
        </div>

        <div className="lp-scroll max-h-[60dvh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Alert if I have not arrived within
            </p>
            <div className="grid grid-cols-3 gap-2">
              {GRACE_OPTIONS.map((option) => (
                <button
                  key={option.seconds}
                  type="button"
                  onClick={() => setGraceSeconds(option.seconds)}
                  className={cn(
                    "lp-focus rounded-xl border py-2.5 text-sm font-medium transition",
                    graceSeconds === option.seconds
                      ? "border-teal-400/55 bg-teal-400/15 text-teal-200"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]",
                  )}
                >
                  +{option.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
              Added on top of the real walking time measured by OSRM, so the
              deadline matches the route rather than a guess.
            </p>
          </div>

          <div>
            <label
              htmlFor="trusted-contact"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
            >
              Trusted contact (optional)
            </label>
            <input
              id="trusted-contact"
              type="tel"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Phone number"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-teal-400/50 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
              Saved on this device only and never sent to LOG POSE. If the walk
              goes overdue, this phone offers to text them.
            </p>
          </div>

          <div className="rounded-xl border border-amber-400/25 bg-amber-400/8 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              What actually happens
            </p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-amber-100/90">
              <li>
                &bull; The deadline is stored on LOG POSE servers and checked every
                minute, so it still fires if you close this tab.
              </li>
              <li>
                &bull; If you do not confirm arrival, an alert is raised on the LOG
                POSE admin dashboard for a human to action.
              </li>
              <li>
                &bull; Your phone will offer one-tap calling to 112 and to the
                nearest mapped police station, and a pre-written message to your
                trusted contact.
              </li>
              <li className="text-amber-200">
                &bull; LOG POSE <strong>cannot</strong> call or message the police
                on your behalf. Do not rely on this instead of calling 112.
              </li>
              {request.destinationKind === "osm_place" && (
                <li className="text-amber-200">
                  &bull; This destination is unverified, so LOG POSE has no contact
                  details for it and nobody there is expecting you.
                </li>
              )}
            </ul>
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-600">
            A Safe Walk stores your start and destination until it resolves, then
            deletes them. No name, phone number or account is stored.
          </p>

          {error && (
            <p
              className="rounded-xl border border-orange-400/25 bg-orange-400/10 px-3.5 py-2.5 text-xs text-orange-200"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-white/8 px-5 py-3">
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="lp-focus flex-1 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-400 disabled:opacity-50"
          >
            {busy ? "Starting..." : "Start Safe Walk"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="lp-focus rounded-xl border border-white/15 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
