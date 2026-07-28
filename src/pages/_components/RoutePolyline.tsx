import L from "leaflet";
import { useEffect } from "react";
import { Polyline, useMap } from "react-leaflet";
import type { BusRoute, BusStop } from "@/data/tirana-bus-data.ts";
import StopMarker from "./StopMarker.tsx";

type Props = {
  route: BusRoute;
  isSelected: boolean;
  isHighlighted: boolean;
  onStopClick: (stop: BusStop, route: BusRoute) => void;
  /** Road-snapped geometry from OSRM. Falls back to stop-to-stop lines if not provided. */
  roadGeometry?: [number, number][];
};

// Invisible clickable overlay for easier line selection
function ClickableOverlay({
  positions,
  onClick,
}: {
  positions: [number, number][];
  onClick: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    const line = L.polyline(positions, {
      color: "transparent",
      weight: 18,
      opacity: 0,
    }).addTo(map);
    line.on("click", onClick);
    return () => {
      line.remove();
    };
  }, [map, positions, onClick]);

  return null;
}

export default function RoutePolyline({
  route,
  isSelected,
  isHighlighted,
  onStopClick,
  roadGeometry,
}: Props) {
  // Prefer the real GTFS shape (official road-following geometry). Fall back to
  // OSRM road-snapped geometry if a shape isn't available, then to straight
  // stop-to-stop lines as a last resort.
  const positions: [number, number][] =
    (route.shape && route.shape.length > 1 ? route.shape : undefined) ??
    roadGeometry ??
    route.stops.map((s) => [s.lat, s.lng] as [number, number]);

  const weight = isSelected ? 6 : isHighlighted ? 4 : 2;
  // Dim routes that are not highlighted (filtered out) unless selected
  const opacity = isSelected ? 1 : isHighlighted ? 0.8 : 0.15;

  return (
    <>
      {/* Shadow line for depth effect on selected routes */}
      {isSelected && (
        <Polyline
          positions={positions}
          pathOptions={{
            color: "#000000",
            weight: weight + 3,
            opacity: 0.15,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}
      <Polyline
        positions={positions}
        pathOptions={{
          color: route.color,
          weight,
          opacity,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      {/* Clickable overlay for non-selected routes */}
      {!isSelected && isHighlighted && (
        <ClickableOverlay
          positions={positions}
          onClick={() => onStopClick(route.stops[0]!, route)}
        />
      )}
      {/* Show stops only for selected route */}
      {isSelected &&
        route.stops.map((stop, idx) => (
          <StopMarker
            key={stop.id}
            stop={stop}
            route={route}
            isFirst={idx === 0}
            isLast={idx === route.stops.length - 1}
            onClick={() => onStopClick(stop, route)}
          />
        ))}
    </>
  );
}
