"use client";

import { useEffect, useState } from "react";
import {
  clearSafeWalk,
  saveTrustedContact,
  useStoredSafeWalk,
  useTrustedContact,
  type StoredSafeWalk,
} from "@/lib/safeWalkStore";
import { formatDistance } from "@/lib/geo";
import { haversineMeters } from "@/lib/geo";
import { cn } from "@/lib/utils";

/**
 * The live Safe Walk countdown.
 *
 * IMPORTANT: this panel does not enforce anything. The deadline it displays is
 * a mirror of a server-side record swept once a minute, which is what makes
 * the escalation survive a closed tab or a dead battery. The countdown here
 * exists so the user can see the deadline and stand it down, and so their
 * device can offer the handoff actions the moment it lapses.
 */

function useSecondsRemaining(deadlineIso: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineIso) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadlineIso]);

  if (!deadlineIso) return null;
  const deadline = new Date(deadlineIso).getTime();
  if (!Number.isFinite(deadline)) return null;
  return Math.round((deadline - now) / 1000);
}

function formatCountdown(seconds: number): string {
  const abs = Math.abs(seconds);
  const minutes = Math.floor(abs / 60);
  const secs = abs % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function buildHelpMessage(walk: StoredSafeWalk): string {
  const mapLink = `https://www.openstreetmap.org/?mlat=${walk.destinationLat}&mlon=${walk.destinationLng}#map=17/${walk.destinationLat}/${walk.destinationLng}`;
  return (
    `I set a LOG POSE Safe Walk to "${walk.destinationName}" and have not confirmed arrival. ` +
    `Destination: ${mapLink}. Please check on me.`
  );
}

interface SafeWalkPanelProps {
  className?: string;
}

export function SafeWalkPanel({ className }: SafeWalkPanelProps) {
  const walk = useStoredSafeWalk();
  const trustedContact = useTrustedContact();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState("");

  const remaining = useSecondsRemaining(walk?.expectedArrivalAt);

  if (!walk || remaining === null) return null;

  const overdue = remaining <= 0;

  const resolve = async (outcome: "arrived" | "cancelled") => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/safe-walk/${walk.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceToken: walk.deviceToken, outcome }),
      });

      if (!response.ok && response.status !== 404) {
        const data = (await response.json()) as { error?: string };
        setError(
          data.error ??
            "Could not stand the Safe Walk down. It is still being watched.",
        );
        return;
      }

      clearSafeWalk();
    } catch {
      setError(
        "Could not reach LOG POSE. The Safe Walk is still recorded and will still escalate.",
      );
    } finally {
      setBusy(false);
    }
  };

  const policeDistance =
    walk.police &&
    formatDistance(
      haversineMeters(
        { lat: walk.destinationLat, lng: walk.destinationLng },
        { lat: walk.police.lat, lng: walk.police.lng },
      ),
    );

  return (
    <div
      className={cn(
        "lp-glass lp-fade-up rounded-2xl p-4 shadow-2xl",
        overdue ? "border-rose-400/50 bg-rose-950/40" : "border-teal-400/25",
        className,
      )}
      role={overdue ? "alert" : "status"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              overdue ? "text-rose-300" : "text-teal-300",
            )}
          >
            {overdue ? "Safe Walk overdue" : "Safe Walk active"}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-white">
            {walk.destinationName}
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 text-2xl font-semibold tabular-nums",
            overdue ? "text-rose-300" : "text-teal-300",
          )}
        >
          {overdue ? "+" : ""}
          {formatCountdown(remaining)}
        </p>
      </div>

      {!overdue && (
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
          If you do not confirm arrival in time, LOG POSE raises an alert on its
          admin dashboard and this phone will offer to message your trusted
          contact.
        </p>
      )}

      {overdue && (
        <div className="mt-3 space-y-2.5">
          <p className="text-[11px] leading-relaxed text-rose-100/90">
            You did not confirm arrival. An alert has been raised on the LOG POSE
            admin dashboard.
            {walk.destinationKind === "osm_place" && (
              <>
                {" "}
                This destination is an unverified OpenStreetMap place, so LOG POSE
                holds no contact details for it and nobody there is expecting you.
              </>
            )}
          </p>

          <p className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-rose-100">
            LOG POSE cannot contact the police for you. Use the buttons below to
            call or message from this phone.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="tel:112"
              className="rounded-xl bg-rose-500 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              Call 112
            </a>

            {walk.police?.phone ? (
              <a
                href={`tel:${walk.police.phone}`}
                className="rounded-xl border border-rose-300/40 py-2.5 text-center text-sm font-medium text-rose-100 transition hover:bg-rose-500/15"
              >
                Call police station
              </a>
            ) : (
              <a
                href={
                  walk.police
                    ? `https://www.openstreetmap.org/?mlat=${walk.police.lat}&mlon=${walk.police.lng}#map=17/${walk.police.lat}/${walk.police.lng}`
                    : "https://www.openstreetmap.org"
                }
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/20 py-2.5 text-center text-sm font-medium text-zinc-100 transition hover:bg-white/5"
              >
                {walk.police ? "Show police station" : "No station mapped"}
              </a>
            )}
          </div>

          {walk.police && (
            <p className="text-[11px] text-zinc-400">
              Nearest mapped station: {walk.police.name}
              {policeDistance && ` \u00b7 ${policeDistance} from your destination`}
              {!walk.police.phone && " \u00b7 no phone number in OpenStreetMap"}
            </p>
          )}

          {trustedContact ? (
            <a
              href={`sms:${trustedContact}?&body=${encodeURIComponent(buildHelpMessage(walk))}`}
              className="block rounded-xl border border-white/20 py-2.5 text-center text-sm font-medium text-zinc-100 transition hover:bg-white/5"
            >
              Text my trusted contact
            </a>
          ) : (
            <div className="flex gap-2">
              <input
                type="tel"
                value={contactDraft}
                onChange={(event) => setContactDraft(event.target.value)}
                placeholder="Trusted contact number"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-teal-400/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => saveTrustedContact(contactDraft)}
                className="shrink-0 rounded-xl border border-white/20 px-3 py-2 text-sm text-zinc-100 transition hover:bg-white/5"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2.5 rounded-lg border border-orange-400/25 bg-orange-400/10 px-2.5 py-2 text-[11px] text-orange-200">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void resolve("arrived")}
          disabled={busy}
          className="lp-focus flex-1 rounded-xl bg-teal-500 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-teal-400 disabled:opacity-50"
        >
          {busy ? "Saving..." : "I've arrived safely"}
        </button>
        <button
          type="button"
          onClick={() => void resolve("cancelled")}
          disabled={busy}
          className="lp-focus rounded-xl border border-white/15 px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
