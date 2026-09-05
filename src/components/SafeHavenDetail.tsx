"use client";

import { OpenStatePill, VerifiedBadge } from "./PlaceBadges";
import type { VerifiedSafeHaven } from "@/lib/types";

interface SafeHavenDetailProps {
  haven: VerifiedSafeHaven;
  onClose: () => void;
  onNavigate: () => void;
}

export function SafeHavenFacilities({ haven }: { haven: VerifiedSafeHaven }) {
  const facilities = [
    haven.staffAvailable && "Staff available",
    haven.securityAvailable && "Security personnel",
    haven.waitingArea && "Waiting area",
    haven.safeRoom && "Private safe room",
    haven.firstAid && "First aid",
    haven.cctv && "CCTV",
    haven.emergencyExit && "Emergency exit",
    haven.wheelchairAccessible && "Wheelchair accessible",
    haven.accessibleEntrance && "Accessible entrance",
    haven.accessibleRestroom && "Accessible restroom",
  ].filter((value): value is string => Boolean(value));

  if (facilities.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No facilities were confirmed during verification.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
      {facilities.map((facility) => (
        <li key={facility} className="flex items-start gap-1.5 text-xs text-zinc-300">
          <span className="mt-0.5 text-teal-400" aria-hidden="true">
            &#10003;
          </span>
          {facility}
        </li>
      ))}
    </ul>
  );
}

export function SafeHavenDetail({ haven, onClose, onNavigate }: SafeHavenDetailProps) {
  return (
    <div className="lp-glass lp-fade-up rounded-2xl border-teal-400/25 p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <VerifiedBadge />
          <h3 className="mt-2 truncate font-semibold text-white">{haven.name}</h3>
          <p className="text-xs text-zinc-400">
            {haven.type}
            {haven.distanceFromRoute !== undefined && (
              <> &middot; {haven.distanceFromRoute} m from route</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Safe Haven details"
          className="shrink-0 rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          &times;
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
        <div>
          <p className="text-xl font-semibold leading-none tabular-nums text-teal-300">
            {haven.trustScore}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Trust Score
          </p>
        </div>
        <div className="min-w-0 border-l border-white/10 pl-4">
          <OpenStatePill state={haven.openState} />
          <p className="mt-1 truncate text-[11px] text-zinc-500">
            {haven.is247 ? "Open 24/7" : haven.openingHours || "Hours not listed"}
          </p>
        </div>
      </div>

      {haven.description && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">{haven.description}</p>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Confirmed on site
        </p>
        <SafeHavenFacilities haven={haven} />
      </div>

      {haven.assistanceOptions.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Assistance offered
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">
            {haven.assistanceOptions.join(", ")}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onNavigate}
        className="mt-4 w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-400"
      >
        Walk here
      </button>

      <p className="mt-2 text-[11px] leading-snug text-zinc-600">
        Physically verified by a LOG POSE representative. Verification does not
        guarantee assistance in every circumstance.
      </p>
    </div>
  );
}
