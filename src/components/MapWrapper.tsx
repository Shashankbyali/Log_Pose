"use client";

import dynamic from "next/dynamic";
import type {
  LatLng,
  OsmPlace,
  ScoredRoute,
  VerifiedSafeHaven,
} from "@/lib/types";

/** Leaflet touches `window`, so the map is loaded lazily on the client only. */
const LogPoseMap = dynamic(() => import("./LogPoseMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-sm text-zinc-500">
      Loading map...
    </div>
  ),
});

interface MapWrapperProps {
  origin: LatLng;
  destination: LatLng;
  routes: ScoredRoute[];
  selectedRouteId: string;
  safeHavens: VerifiedSafeHaven[];
  osmPlaces: OsmPlace[];
  showOsmPlaces: boolean;
  onHavenSelect: (haven: VerifiedSafeHaven) => void;
  className?: string;
}

export function MapWrapper(props: MapWrapperProps) {
  return <LogPoseMap {...props} />;
}
