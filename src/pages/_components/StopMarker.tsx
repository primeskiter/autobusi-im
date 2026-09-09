import L from "leaflet";
import { useEffect, useRef } from "react";
import { Marker } from "react-leaflet";
import type { BusRoute, BusStop } from "@/data/tirana-bus-data.ts";

type Props = {
  stop: BusStop;
  route: BusRoute;
  isFirst: boolean;
  isLast: boolean;
  isSelected?: boolean;
  onClick: () => void;
};

function createStopIcon(isSelected: boolean) {
  if (isSelected) {
    // Selected stop: bigger, colored, with a pulsing ring so it's
    // unmistakable at a glance — the one thing that should visually
    // "stand out" on an otherwise uniform map.
    const size = 22;
    const svg = `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:var(--primary);opacity:0.5;"></span>
        <svg width="${size}" height="${size}" style="position:relative;">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}"
            fill="var(--primary)" stroke="white" stroke-width="3"/>
        </svg>
      </div>
    `;
    return L.divIcon({
      html: svg,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      className: "",
    });
  }

  // Default: every stop looks identical regardless of which route(s) serve
  // it — differentiating stops by route color was what made the map read
  // as chaotic once multiple routes' stops overlapped on screen.
  const size = 9;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size + 4}" height="${size + 4}">
      <circle cx="${(size + 4) / 2}" cy="${(size + 4) / 2}" r="${size / 2}"
        fill="white" stroke="#94a3b8" stroke-width="2"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    className: "",
  });
}

export default function StopMarker({ stop, isSelected = false, onClick }: Props) {
  const icon = createStopIcon(isSelected);
  const markerRef = useRef<L.Marker>(null);

  // Selected stops render above unselected ones so the highlight ring never
  // gets visually clipped by a neighboring stop's marker.
  useEffect(() => {
    if (isSelected) markerRef.current?.setZIndexOffset(1000);
  }, [isSelected]);

  return (
    <Marker
      ref={markerRef}
      position={[stop.lat, stop.lng]}
      icon={icon}
      eventHandlers={{ click: onClick }}
    />
  );
}
