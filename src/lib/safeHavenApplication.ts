import { SERVICE_AREA } from "./constants";
import { ASSISTANCE_OPTIONS, SAFE_HAVEN_TYPES, type SafeHavenType } from "./types";

/**
 * Shape and validation for a Safe Haven application, shared by the public
 * registration form and the API route so both agree on the rules.
 *
 * Submitting this form does NOT make a business a LOG POSE Safe Haven. The
 * application starts at `pending` and must pass review, a physical field
 * verification visit and admin approval.
 */

export interface SafeHavenApplicationInput {
  name: string;
  type: SafeHavenType;
  description: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  latitude: number;
  longitude: number;

  openingHours: string;
  is247: boolean;
  employeeCount: number | null;
  staffAvailable: boolean;
  securityAvailable: boolean;
  securityHours: string;
  femaleStaffAvailable: boolean;

  safeRoom: boolean;
  waitingArea: boolean;
  seating: boolean;
  restroom: boolean;
  temporaryShelter: boolean;
  staffAssistance: boolean;

  firstAid: boolean;
  cctv: boolean;
  emergencyExit: boolean;
  fireExtinguisher: boolean;
  emergencyAlarm: boolean;

  wheelchairAccessible: boolean;
  accessibleEntrance: boolean;
  accessibleRestroom: boolean;
  elevator: boolean;

  assistanceOptions: string[];
  contactPersonName: string;
  contactPersonPhone: string;
  consentToVerification: boolean;
}

export const EMPTY_APPLICATION: SafeHavenApplicationInput = {
  name: "",
  type: "Pharmacy",
  description: "",
  address: "",
  city: "Bengaluru",
  pincode: "",
  phone: "",
  latitude: Number.NaN,
  longitude: Number.NaN,

  openingHours: "",
  is247: false,
  employeeCount: null,
  staffAvailable: false,
  securityAvailable: false,
  securityHours: "",
  femaleStaffAvailable: false,

  safeRoom: false,
  waitingArea: false,
  seating: false,
  restroom: false,
  temporaryShelter: false,
  staffAssistance: false,

  firstAid: false,
  cctv: false,
  emergencyExit: false,
  fireExtinguisher: false,
  emergencyAlarm: false,

  wheelchairAccessible: false,
  accessibleEntrance: false,
  accessibleRestroom: false,
  elevator: false,

  assistanceOptions: [],
  contactPersonName: "",
  contactPersonPhone: "",
  consentToVerification: false,
};



export type ValidationErrors = Partial<
  Record<keyof SafeHavenApplicationInput, string>
>;

export function validateApplication(
  input: SafeHavenApplicationInput,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (input.name.trim().length < 3) {
    errors.name = "Enter the registered business name";
  }
  if (!SAFE_HAVEN_TYPES.includes(input.type)) {
    errors.type = "Choose an establishment type";
  }
  if (input.address.trim().length < 8) {
    errors.address = "Enter the full street address";
  }
  if (input.city.trim().length < 3) {
    errors.city = "Enter the city";
  }
  if (!/^\d{6}$/.test(input.pincode.trim())) {
    errors.pincode = "Enter a valid 6-digit pincode";
  }
  if (!/^[+]?\d{10,13}$/.test(input.phone.replace(/[\s-]/g, ""))) {
    errors.phone = "Enter a valid contact number";
  }

  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    errors.latitude = "Set the establishment location on the map";
  } else if (
    input.latitude < SERVICE_AREA.south ||
    input.latitude > SERVICE_AREA.north ||
    input.longitude < SERVICE_AREA.west ||
    input.longitude > SERVICE_AREA.east
  ) {
    errors.latitude =
      "LOG POSE currently verifies establishments in the Bengaluru area only";
  }

  if (!input.is247 && input.openingHours.trim().length < 3) {
    errors.openingHours = "Enter opening hours, or select 24/7 availability";
  }
  if (
    input.employeeCount !== null &&
    (!Number.isInteger(input.employeeCount) || input.employeeCount < 0)
  ) {
    errors.employeeCount = "Enter a valid number of employees";
  }

  const unknownAssistance = input.assistanceOptions.filter(
    (option) => !ASSISTANCE_OPTIONS.includes(option as (typeof ASSISTANCE_OPTIONS)[number]),
  );
  if (unknownAssistance.length > 0) {
    errors.assistanceOptions = "Unrecognised assistance option selected";
  }
  if (input.assistanceOptions.length === 0) {
    errors.assistanceOptions = "Select at least one way you can assist someone";
  }

  if (input.contactPersonName.trim().length < 3) {
    errors.contactPersonName = "Enter the name of the person we should contact";
  }
  if (!/^[+]?\d{10,13}$/.test(input.contactPersonPhone.replace(/[\s-]/g, ""))) {
    errors.contactPersonPhone = "Enter a valid contact number";
  }
  if (!input.consentToVerification) {
    errors.consentToVerification =
      "A physical verification visit is required to become a Safe Haven";
  }

  return errors;
}

/** Maps a validated application to its Supabase row. */
export function toSafeHavenRow(input: SafeHavenApplicationInput) {
  return {
    name: input.name.trim(),
    type: input.type,
    description: input.description.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    pincode: input.pincode.trim(),
    phone: input.phone.replace(/[\s-]/g, ""),
    latitude: input.latitude,
    longitude: input.longitude,

    opening_hours: input.is247 ? "24/7" : input.openingHours.trim(),
    is_24_7: input.is247,
    employee_count: input.employeeCount,
    staff_available: input.staffAvailable,
    security_available: input.securityAvailable,
    security_hours: input.securityHours.trim() || null,
    female_staff_available: input.femaleStaffAvailable,

    safe_room: input.safeRoom,
    waiting_area: input.waitingArea,
    seating: input.seating,
    restroom: input.restroom,
    temporary_shelter: input.temporaryShelter,
    staff_assistance: input.staffAssistance,

    first_aid: input.firstAid,
    cctv: input.cctv,
    emergency_exit: input.emergencyExit,
    fire_extinguisher: input.fireExtinguisher,
    emergency_alarm: input.emergencyAlarm,

    wheelchair_accessible: input.wheelchairAccessible,
    accessible_entrance: input.accessibleEntrance,
    accessible_restroom: input.accessibleRestroom,
    elevator: input.elevator,

    assistance_options: input.assistanceOptions,
    contact_person_name: input.contactPersonName.trim(),
    contact_person_phone: input.contactPersonPhone.replace(/[\s-]/g, ""),

    // Never client-controlled: a new application is always unverified.
    verification_status: "pending" as const,
    trust_score: 0,
  };
}
