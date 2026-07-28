import { useState } from "react";
import { useMapEvents } from "react-leaflet";
import { BUS_ROUTES, type BusRoute, type BusStop } from "@/data/tirana-bus-data.ts";
import StopMarker from "./StopMarker.tsx";

type Props = {
  selectedRouteId: string | null;
  onStopClick: (stop: BusStop, route: BusRoute) => void;
};

/** Minimum zoom level to show individual bus stops */
const MIN_ZOOM_FOR_STOPS = 15;

/**
 * Renders all bus stops on the map when the user zooms in past a threshold.
 * Stops from the currently selected route are excluded (they are rendered by RoutePolyline).
 */
export default function ZoomStopMarkers({ selectedRouteId, onStopClick }: Props) {
  const [zoom, setZoom] = useState<number>(13);

  useMapEvents({
    zoomend: (e) => {
      setZoom(e.target.getZoom());
    },
  });

  if (zoom < MIN_ZOOM_FOR_STOPS) return null;

  // Collect unique stops across all routes (deduplicated by stop id)
  // but keep track of which route each stop belongs to for the marker
  const renderedStopIds = new Set<string>();
  const stopsToRender: { stop: BusStop; route: BusRoute; isFirst: boolean; isLast: boolean }[] = [];

  for (const route of BUS_ROUTES) {
    // Skip the selected route — its stops are already shown by RoutePolyline
    if (route.id === selectedRouteId) continue;

    for (let idx = 0; idx < route.stops.length; idx++) {
      const stop = route.stops[idx]!;
      if (renderedStopIds.has(stop.id)) continue;
      renderedStopIds.add(stop.id);
      stopsToRender.push({
        stop,
        route,
        isFirst: idx === 0,
        isLast: idx === route.stops.length - 1,
      });
    }
  }

  return (
    <>
      {stopsToRender.map(({ stop, route, isFirst, isLast }) => (
        <StopMarker
          key={stop.id}
          stop={stop}
          route={route}
          isFirst={isFirst}
          isLast={isLast}
          onClick={() => onStopClick(stop, route)}
        />
      ))}
    </>
  );
}
