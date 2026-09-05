"use client";

import { EmergencyAccessBadge, OpenStatePill } from "./PlaceBadges";
import type { OsmPlace } from "@/lib/types";
import { formatWalkingEta } from "@/lib/walkingEta";

interface EmergencyFacilityDetailProps {
  place: OsmPlace;
  onClose: () => void;
  onNavigate: () => void;
}

export function EmergencyFacilityDetail({
  place,
  onClose,
  onNavigate,
}: EmergencyFacilityDetailProps) {
  return (
    <div className="lp-glass lp-fade-up rounded-2xl border-rose-400/25 p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <EmergencyAccessBadge />
          <h3 className="mt-2 truncate font-semibold text-white">{place.name}</h3>
          <p className="text-xs capitalize text-zinc-400">
            {(place.officialFacilityType ?? place.category).replaceAll("_", " ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close emergency facility details"
          className="shrink-0 rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          &times;
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-xs">
        <div>
          <p className="text-zinc-500">Distance</p>
          <p className="mt-1 font-medium text-zinc-100">
            {place.distanceFromUserMeters !== undefined
              ? `${place.distanceFromUserMeters} m away`
              : place.distanceFromRoute !== undefined
                ? `${place.distanceFromRoute} m from route`
              : "Distance unavailable"}
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Opening status</p>
          <div className="mt-1">
            <OpenStatePill state={place.openState} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-300">
        Walking ETA: <span className="font-medium text-white">
          {place.walkingDurationSeconds === null || place.walkingDurationSeconds === undefined
            ? "ETA unavailable"
            : formatWalkingEta(place.walkingDurationSeconds)}
        </span>
      </p>
      {place.address && <p className="mt-2 text-xs text-zinc-400">{place.address}</p>}
      {place.phone && (
        <a
          href={`tel:${place.phone}`}
          className="mt-2 block text-xs text-rose-200 underline decoration-rose-300/40 underline-offset-2"
        >
          Call {place.phone}
        </a>
      )}

      <button
        type="button"
        onClick={onNavigate}
        className="mt-4 w-full rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
      >
        Walk here
      </button>

      <p className="mt-2 text-[11px] leading-snug text-zinc-600">
        Source: OpenStreetMap / Official Emergency Facility. This is not a LOG POSE
        physically verified Safe Haven.
      </p>
    </div>
  );
}
