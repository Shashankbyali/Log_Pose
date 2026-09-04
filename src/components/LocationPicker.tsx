"use client";

import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/types";

const PickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-xl bg-zinc-900 text-sm text-zinc-500">
      Loading map...
    </div>
  ),
});

interface LocationPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
}

/**
 * Lets an applicant place their establishment precisely on the real map,
 * so verification staff can find it. Coordinates are read from the map, never
 * guessed from the address.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  return (
    <div>
      <PickerMap value={value} onChange={onChange} />
      <p className="mt-1.5 text-[11px] text-zinc-500">
        {value
          ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : "Tap the map to mark your establishment's exact entrance."}
      </p>
    </div>
  );
}
