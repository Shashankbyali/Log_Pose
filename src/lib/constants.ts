/** Shared constants safe to import from both client and server code. */

export const ADMIN_TOKEN_HEADER = "x-logpose-admin";

export const BRAND_NAME = "LOG POSE";
export const BRAND_TAGLINE = "The route to a safer tomorrow.";

/** Live-data service area for the Bengaluru MVP. */
export const SERVICE_AREA = {
  south: 12.7,
  west: 77.3,
  north: 13.25,
  east: 77.9,
} as const;
