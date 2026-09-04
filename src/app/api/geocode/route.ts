import { NextResponse, type NextRequest } from "next/server";
import type { GeocodeResult } from "@/lib/types";

/**
 * Real destination search via Nominatim (OpenStreetMap).
 *
 * Results are biased to the Bengaluru live-data area. No destination is ever
 * invented: when Nominatim returns nothing, the response is an empty list.
 *
 * Nominatim usage policy requires an identifying User-Agent and low request
 * volume, so this runs server-side and the client debounces input.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "LogPose-SafetyNavigation/1.0 (hackathon prototype)";
const REQUEST_TIMEOUT_MS = 8000;

/** Bengaluru viewbox: west,north,east,south */
const BENGALURU_VIEWBOX = "77.30,13.25,77.90,12.70";

interface NominatimPlace {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    limit: "6",
    addressdetails: "0",
    viewbox: BENGALURU_VIEWBOX,
    // Bias towards Bengaluru but still allow strong matches outside the box.
    bounded: "0",
    countrycodes: "in",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Destination search is unavailable right now" },
        { status: 502 },
      );
    }

    const data = (await response.json()) as NominatimPlace[];

    const results: GeocodeResult[] = data.map((place) => {
      const [primary, ...rest] = place.display_name.split(",");
      return {
        id: String(place.place_id),
        name: place.name?.trim() || primary.trim(),
        detail: rest.join(",").trim(),
        lat: Number.parseFloat(place.lat),
        lng: Number.parseFloat(place.lon),
      };
    });

    return NextResponse.json({ results, attribution: "Search by OpenStreetMap / Nominatim" });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        error: timedOut
          ? "Destination search timed out"
          : "Destination search is unavailable right now",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}
