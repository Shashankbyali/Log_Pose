export type SafetyPreference = "fastest" | "balanced" | "safest";

/**
 * `alternative` is used when the fastest route also has the highest Safety
 * Score, so there is no genuine safety-for-time trade-off to label. Inventing
 * a "safest" option in that case would misrepresent the data.
 */
export type RouteLabel = "fastest" | "balanced" | "safest" | "alternative";

export type DataMode = "live" | "demo";

export type OpenState = "open" | "closed" | "unknown";

export const SAFE_HAVEN_TYPES = [
  "Pharmacy",
  "Hospital",
  "Petrol Pump",
  "Cafe / Restaurant",
  "Hotel",
  "Grocery / Convenience Store",
  "College / University",
  "Shopping Mall",
  "Security Office",
  "Police Facility",
  "Other",
] as const;

export type SafeHavenType = (typeof SAFE_HAVEN_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "pending",
  "under_review",
  "field_verification",
  "verified",
  "rejected",
  "suspended",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ASSISTANCE_OPTIONS = [
  "Allow person to wait inside",
  "Contact emergency services",
  "Contact a trusted person",
  "First aid",
  "Drinking water",
  "Restroom access",
  "Temporary shelter",
  "Staff assistance",
] as const;

export type AssistanceOption = (typeof ASSISTANCE_OPTIONS)[number];

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface RouteGeometry {
  coordinates: LatLng[];
}

export interface RouteSegment {
  distance: number;
  duration: number;
}

/** How a route geometry was obtained. Every value here is a real OSRM result. */
export type RouteSource = "osrm-primary" | "osrm-alternative" | "osrm-via" | "demo";

export interface RawRoute {
  id: string;
  geometry: RouteGeometry;
  distance: number;
  duration: number;
  segments?: RouteSegment[];
  source: RouteSource;
  /** Human-readable note about how this route was produced, shown in the UI. */
  sourceNote: string;
}

export interface SafetyWeights {
  lighting: number;
  activity: number;
  safeHaven: number;
  establishment: number;
  accessibility: number;
  emergency: number;
}

export type SafetyFactorKey = keyof SafetyWeights;

/**
 * Measured, real-world inputs for one route. `null` means the data source did
 * not return usable information -- it must never be silently treated as zero.
 */
export interface RouteSafetyInputs {
  /** Mapped `highway=street_lamp` nodes within the lighting corridor. */
  mappedLampsNearRoute: number | null;
  /** Mapped activity-generating establishments within the activity corridor. */
  activityPoisNearRoute: number | null;
  /** Establishments near the route split by parsed OSM opening_hours. */
  establishmentsOpen: number | null;
  establishmentsClosed: number | null;
  establishmentsUnknown: number | null;
  /** Metres of mapped footway/sidewalk running alongside the route. */
  pedestrianWayMeters: number | null;
  /** Mapped pedestrian crossings near the route. */
  pedestrianCrossings: number | null;
  /** Metres from the route to the nearest mapped emergency facility. */
  nearestEmergencyMeters: number | null;
  /** LOG POSE verified Safe Havens near the route. */
  verifiedSafeHavensNearRoute: VerifiedSafeHaven[] | null;
  /** Route length in metres, used to normalise counts per kilometre. */
  routeDistanceMeters: number;
}

export interface SafetyFactor {
  key: SafetyFactorKey;
  label: string;
  /** 0-100, or null when the underlying data is unavailable. */
  score: number | null;
  /** Weight actually applied after renormalising over available factors. */
  appliedWeight: number;
  /** The measured real-world value behind the score, for transparency. */
  evidence: string;
  /** Where the data came from. */
  source: string;
}

export interface SafetyFactorScores {
  /** 0-100 weighted score over available factors, or null if nothing is known. */
  totalScore: number | null;
  lightingScore: number | null;
  activityScore: number | null;
  safeHavenScore: number | null;
  establishmentScore: number | null;
  accessibilityScore: number | null;
  emergencyScore: number | null;
  factors: SafetyFactor[];
  reasons: string[];
  /** Share of the weighting model backed by available data (0-1). */
  dataCoverage: number;
  unavailableFactors: string[];
}

export interface ScoredRoute extends RawRoute {
  safety: SafetyFactorScores;
  label: RouteLabel;
}

/** A place discovered through OpenStreetMap. NOT a LOG POSE Safe Haven. */
export interface OsmPlace {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  openState: OpenState;
  openingHoursRaw: string | null;
  distanceFromRoute?: number;
  isEmergencyFacility: boolean;
}

/** A physically verified LOG POSE Safe Haven. */
export interface VerifiedSafeHaven {
  id: string;
  name: string;
  type: SafeHavenType;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  pincode: string;
  openingHours: string;
  is247: boolean;
  openState: OpenState;
  staffAvailable: boolean;
  securityAvailable: boolean;
  safeRoom: boolean;
  waitingArea: boolean;
  firstAid: boolean;
  cctv: boolean;
  emergencyExit: boolean;
  wheelchairAccessible: boolean;
  accessibleEntrance: boolean;
  accessibleRestroom: boolean;
  assistanceOptions: string[];
  trustScore: number;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  distanceFromRoute?: number;
}

export interface SafeHavenApplication extends VerifiedSafeHaven {
  phone: string;
  employeeCount: number | null;
  securityHours: string | null;
  femaleStaffAvailable: boolean;
  restroom: boolean;
  seating: boolean;
  temporaryShelter: boolean;
  fireExtinguisher: boolean;
  emergencyAlarm: boolean;
  elevator: boolean;
  staffAssistance: boolean;
  assignedVerifier: string | null;
  verificationNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  destinationName?: string;
  originName?: string;
}

export interface GeocodeResult {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
}

/** Result of the full live planning pipeline. */
export interface PlanResult {
  mode: DataMode;
  routes: ScoredRoute[];
  osmPlaces: OsmPlace[];
  safeHavens: VerifiedSafeHaven[];
  /** Non-fatal problems, e.g. "Overpass unavailable -- lighting data missing". */
  warnings: string[];
}

export interface SafePlaceOption extends VerifiedSafeHaven {
  /** Straight-line metres from the user. */
  distanceMeters: number;
  /** Real OSRM walking distance/duration, when routing succeeded. */
  walkingDistanceMeters: number | null;
  walkingDurationSeconds: number | null;
  rankScore: number;
}

/**
 * An OpenStreetMap establishment offered as a fallback when the verified Safe
 * Haven network has nothing nearby.
 *
 * This is NOT a Safe Haven: nobody from LOG POSE has visited it, it has no
 * Trust Score, and it has made no commitment to assist. Everything here is
 * copied from OSM tags, never inferred.
 */
export interface NearbyPlace {
  id: string;
  name: string;
  /** Human-readable OSM category, e.g. "Pharmacy". */
  category: string;
  latitude: number;
  longitude: number;
  openState: OpenState;
  openingHoursRaw: string | null;
  isEmergencyFacility: boolean;
}

export interface NearbyPlaceOption extends NearbyPlace {
  distanceMeters: number;
  walkingDistanceMeters: number | null;
  walkingDurationSeconds: number | null;
  rankScore: number;
}

/** Response of the "I need a safe place" endpoint. */
export interface SafePlaceSearchResult {
  /** Verified Safe Havens, or null when the network could not be read. */
  verified: SafePlaceOption[] | null;
  verifiedWarning: string | null;
  /** Unverified OSM fallback, or null when OpenStreetMap could not be read. */
  nearby: NearbyPlaceOption[] | null;
  nearbyWarning: string | null;
  searchRadiusMeters: number;
}
