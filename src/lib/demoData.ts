import { assignRouteLabels } from "./routing";
import { calculateSafetyScore } from "./safetyEngine";
import type {
  LatLng,
  OsmPlace,
  PlanResult,
  RawRoute,
  RouteSafetyInputs,
  ScoredRoute,
  VerifiedSafeHaven,
} from "./types";

/**
 * DEMO MODE DATA -- PREDEFINED, NOT REAL MEASUREMENTS.
 *
 * Demo Mode exists for judging, offline demonstration, denied GPS and API
 * outages. It is always labelled in the UI and its data is never mixed with
 * Live Mode data.
 *
 * Note that the demo route measurements below are fed through the SAME real
 * Safety Engine as Live Mode, so demo scores are computed rather than
 * hardcoded -- only the underlying measurements are predefined.
 */

export const DEMO_ORIGIN: LatLng = { lat: 12.9716, lng: 77.5946 };
export const DEMO_DESTINATION: LatLng = { lat: 12.9789, lng: 77.6098 };
export const DEMO_ORIGIN_NAME = "Demo: MG Road area, Bengaluru";
export const DEMO_DESTINATION_NAME = "Demo: Ulsoor campus area, Bengaluru";

function demoHaven(
  haven: Omit<VerifiedSafeHaven, "verificationStatus" | "verifiedAt">,
): VerifiedSafeHaven {
  return { ...haven, verificationStatus: "verified", verifiedAt: "2026-02-14T00:00:00Z" };
}

export const DEMO_SAFE_HAVENS: VerifiedSafeHaven[] = [
  demoHaven({
    id: "demo-sh-1",
    name: "Demo Pharmacy — Brigade Road",
    type: "Pharmacy",
    description: "Demo record: staffed pharmacy with a waiting area near the entrance.",
    latitude: 12.9728,
    longitude: 77.5982,
    address: "Brigade Road (demo address)",
    city: "Bengaluru",
    pincode: "560001",
    openingHours: "Mo-Su 08:00-23:00",
    is247: false,
    openState: "open",
    staffAvailable: true,
    securityAvailable: false,
    safeRoom: false,
    waitingArea: true,
    firstAid: true,
    cctv: true,
    emergencyExit: true,
    wheelchairAccessible: true,
    accessibleEntrance: true,
    accessibleRestroom: false,
    assistanceOptions: [
      "Allow person to wait inside",
      "Contact emergency services",
      "First aid",
      "Drinking water",
    ],
    trustScore: 88,
  }),
  demoHaven({
    id: "demo-sh-2",
    name: "Demo Fuel Station — Halasuru Road",
    type: "Petrol Pump",
    description: "Demo record: 24/7 staffed forecourt with security personnel.",
    latitude: 12.9745,
    longitude: 77.6015,
    address: "Halasuru Road (demo address)",
    city: "Bengaluru",
    pincode: "560008",
    openingHours: "24/7",
    is247: true,
    openState: "open",
    staffAvailable: true,
    securityAvailable: true,
    safeRoom: false,
    waitingArea: true,
    firstAid: true,
    cctv: true,
    emergencyExit: true,
    wheelchairAccessible: false,
    accessibleEntrance: true,
    accessibleRestroom: false,
    assistanceOptions: [
      "Allow person to wait inside",
      "Contact emergency services",
      "Contact a trusted person",
      "Restroom access",
      "Staff assistance",
    ],
    trustScore: 93,
  }),
  demoHaven({
    id: "demo-sh-3",
    name: "Demo Hospital — Ulsoor",
    type: "Hospital",
    description: "Demo record: emergency department open around the clock.",
    latitude: 12.9768,
    longitude: 77.6042,
    address: "Ulsoor (demo address)",
    city: "Bengaluru",
    pincode: "560008",
    openingHours: "24/7",
    is247: true,
    openState: "open",
    staffAvailable: true,
    securityAvailable: true,
    safeRoom: true,
    waitingArea: true,
    firstAid: true,
    cctv: true,
    emergencyExit: true,
    wheelchairAccessible: true,
    accessibleEntrance: true,
    accessibleRestroom: true,
    assistanceOptions: [
      "Allow person to wait inside",
      "Contact emergency services",
      "Contact a trusted person",
      "First aid",
      "Drinking water",
      "Restroom access",
      "Temporary shelter",
      "Staff assistance",
    ],
    trustScore: 96,
  }),
  demoHaven({
    id: "demo-sh-4",
    name: "Demo Hotel Lobby — Ulsoor Lake",
    type: "Hotel",
    description: "Demo record: front desk staffed during listed hours.",
    latitude: 12.9782,
    longitude: 77.609,
    address: "Ulsoor Lake Road (demo address)",
    city: "Bengaluru",
    pincode: "560008",
    openingHours: "Mo-Su 07:00-23:00",
    is247: false,
    openState: "open",
    staffAvailable: true,
    securityAvailable: true,
    safeRoom: true,
    waitingArea: true,
    firstAid: false,
    cctv: true,
    emergencyExit: true,
    wheelchairAccessible: true,
    accessibleEntrance: true,
    accessibleRestroom: true,
    assistanceOptions: [
      "Allow person to wait inside",
      "Contact a trusted person",
      "Restroom access",
      "Staff assistance",
    ],
    trustScore: 84,
  }),
];

const ROUTE_A_COORDS: LatLng[] = [
  { lat: 12.9716, lng: 77.5946 },
  { lat: 12.9722, lng: 77.5965 },
  { lat: 12.973, lng: 77.5988 },
  { lat: 12.9748, lng: 77.6025 },
  { lat: 12.9765, lng: 77.606 },
  { lat: 12.9789, lng: 77.6098 },
];

const ROUTE_B_COORDS: LatLng[] = [
  { lat: 12.9716, lng: 77.5946 },
  { lat: 12.9725, lng: 77.5958 },
  { lat: 12.9738, lng: 77.5975 },
  { lat: 12.9745, lng: 77.6005 },
  { lat: 12.9758, lng: 77.6035 },
  { lat: 12.9772, lng: 77.6068 },
  { lat: 12.9789, lng: 77.6098 },
];

const ROUTE_C_COORDS: LatLng[] = [
  { lat: 12.9716, lng: 77.5946 },
  { lat: 12.971, lng: 77.5935 },
  { lat: 12.972, lng: 77.595 },
  { lat: 12.9735, lng: 77.597 },
  { lat: 12.975, lng: 77.6005 },
  { lat: 12.9768, lng: 77.6045 },
  { lat: 12.978, lng: 77.6075 },
  { lat: 12.9789, lng: 77.6098 },
];

interface DemoRouteSpec {
  id: string;
  coords: LatLng[];
  distance: number;
  duration: number;
  havenIds: string[];
  measurements: Omit<
    RouteSafetyInputs,
    "routeDistanceMeters" | "verifiedSafeHavensNearRoute"
  >;
}

const DEMO_ROUTES: DemoRouteSpec[] = [
  {
    id: "demo-route-1",
    coords: ROUTE_A_COORDS,
    distance: 1800,
    duration: 1300,
    havenIds: ["demo-sh-1"],
    measurements: {
      mappedLampsNearRoute: 11,
      activityPoisNearRoute: 24,
      establishmentsOpen: 7,
      establishmentsClosed: 6,
      establishmentsUnknown: 11,
      pedestrianWayMeters: 430,
      pedestrianCrossings: 2,
      nearestEmergencyMeters: 1450,
    },
  },
  {
    id: "demo-route-2",
    coords: ROUTE_B_COORDS,
    distance: 2100,
    duration: 1560,
    havenIds: ["demo-sh-1", "demo-sh-2"],
    measurements: {
      mappedLampsNearRoute: 38,
      activityPoisNearRoute: 52,
      establishmentsOpen: 19,
      establishmentsClosed: 8,
      establishmentsUnknown: 25,
      pedestrianWayMeters: 1010,
      pedestrianCrossings: 6,
      nearestEmergencyMeters: 610,
    },
  },
  {
    id: "demo-route-3",
    coords: ROUTE_C_COORDS,
    distance: 2500,
    duration: 1860,
    havenIds: ["demo-sh-1", "demo-sh-2", "demo-sh-3", "demo-sh-4"],
    measurements: {
      mappedLampsNearRoute: 71,
      activityPoisNearRoute: 84,
      establishmentsOpen: 31,
      establishmentsClosed: 9,
      establishmentsUnknown: 30,
      pedestrianWayMeters: 1880,
      pedestrianCrossings: 11,
      nearestEmergencyMeters: 240,
    },
  },
];

export const DEMO_OSM_PLACES: OsmPlace[] = [
  {
    id: "demo-osm-1",
    name: "Demo Cafe",
    category: "Cafe",
    latitude: 12.9735,
    longitude: 77.5968,
    openState: "open",
    openingHoursRaw: "Mo-Su 08:00-22:30",
    address: null,
    phone: null,
    distanceFromRoute: 40,
    isEmergencyFacility: false,
    officialFacilityType: null,
  },
  {
    id: "demo-osm-2",
    name: "Demo Convenience Store",
    category: "Convenience",
    latitude: 12.9752,
    longitude: 77.6028,
    openState: "unknown",
    openingHoursRaw: null,
    address: null,
    phone: null,
    distanceFromRoute: 55,
    isEmergencyFacility: false,
    officialFacilityType: null,
  },
  {
    id: "demo-osm-3",
    name: "Demo Police Station",
    category: "Police",
    latitude: 12.9761,
    longitude: 77.6051,
    openState: "unknown",
    openingHoursRaw: null,
    address: null,
    phone: null,
    distanceFromRoute: 90,
    isEmergencyFacility: true,
    officialFacilityType: "police",
  },
  {
    id: "demo-osm-4",
    name: "Demo Bakery",
    category: "Bakery",
    latitude: 12.9721,
    longitude: 77.5959,
    openState: "closed",
    openingHoursRaw: "Mo-Sa 07:00-13:00",
    address: null,
    phone: null,
    distanceFromRoute: 30,
    isEmergencyFacility: false,
    officialFacilityType: null,
  },
];

export function getDemoPlan(): PlanResult {
  const scored: ScoredRoute[] = DEMO_ROUTES.map((spec) => {
    const raw: RawRoute = {
      id: spec.id,
      geometry: { coordinates: spec.coords },
      distance: spec.distance,
      duration: spec.duration,
      source: "demo",
      sourceNote: "Predefined demo route",
    };

    const havens = DEMO_SAFE_HAVENS.filter((haven) =>
      spec.havenIds.includes(haven.id),
    );

    const safety = calculateSafetyScore({
      ...spec.measurements,
      verifiedSafeHavensNearRoute: havens,
      routeDistanceMeters: spec.distance,
    });

    return { ...raw, safety, label: "balanced" as const };
  });

  return {
    mode: "demo",
    routes: assignRouteLabels(scored),
    osmPlaces: DEMO_OSM_PLACES,
    safeHavens: DEMO_SAFE_HAVENS,
    warnings: [],
  };
}
