"use client";

import { describeOpenState } from "@/lib/openingHours";
import type { VerifiedSafeHaven } from "@/lib/types";

interface SafeHavenDetailProps {
  haven: VerifiedSafeHaven;
  onClose: () => void;
  onNavigate: () => void;
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-teal-400/30 bg-teal-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" />
      </svg>
      LOG POSE Safe Haven
    </span>
  );
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
    <div className="rounded-2xl border border-teal-400/25 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-md">
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

      <div className="mt-3 flex items-center gap-4 rounded-xl bg-white/[0.04] px-3 py-2.5">
        <div>
          <p className="text-lg font-semibold tabular-nums text-teal-300">
            {haven.trustScore}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Trust Score
          </p>
        </div>
        <div className="border-l border-white/10 pl-4">
          <p className="text-sm text-zinc-200">{describeOpenState(haven.openState)}</p>
          <p className="text-[11px] text-zinc-500">
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
