import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "LogPose-SafetyNavigation/1.0 (hackathon prototype)",
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Reverse geocoding failed" }, { status: 502 });
    }

    const data = (await res.json()) as {
      address?: { suburb?: string; city?: string; town?: string };
      display_name?: string;
    };

    const name =
      data.address?.suburb ??
      data.address?.city ??
      data.address?.town ??
      data.display_name?.split(",")[0] ??
      "Your current location";

    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ error: "Reverse geocoding unavailable" }, { status: 503 });
  }
}
