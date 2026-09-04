"use client";

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LatLng } from "@/lib/types";
import "leaflet/dist/leaflet.css";

const BENGALURU_CENTER: LatLng = { lat: 12.9716, lng: 77.5946 };

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#14b8a6;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickHandler({ onChange }: { onChange: (value: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export default function LocationPickerMap({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
}) {
  const center = value ?? BENGALURU_CENTER;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={value ? 17 : 13}
      className="h-56 w-full overflow-hidden rounded-xl"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ClickHandler onChange={onChange} />
      {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
    </MapContainer>
  );
}
