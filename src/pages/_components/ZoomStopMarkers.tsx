import { useState } from "react";
import { useMapEvents } from "react-leaflet";
import { BUS_ROUTES, type BusRoute, type BusStop } from "@/data/tirana-bus-data.ts";
import StopMarker from "./StopMarker.tsx";

type Props = {
  selectedRouteId: string | null;
  selectedStopGtfsId: string | null;
  onStopClick: (stop: BusStop) => void;
};

/** Minimum zoom level to show individual bus stops */
const MIN_ZOOM_FOR_STOPS = 15;

/**
 * Renders all bus stops on the map when the user zooms in past a threshold.
 * Stops from the currently selected route are excluded (they are rendered by RoutePolyline).
 * Deduplicated by the real GTFS stop ID so a physical stop shared by
 * several routes only ever renders once, instead of once per route.
 */
export default function ZoomStopMarkers({ selectedRouteId, selectedStopGtfsId, onStopClick }: Props) {
  const [zoom, setZoom] = useState<number>(13);

  useMapEvents({
    zoomend: (e) => {
      setZoom(e.target.getZoom());
    },
  });

  if (zoom < MIN_ZOOM_FOR_STOPS) return null;

  // Collect unique physical stops across all routes (deduplicated by the
  // real GTFS stop id, not the per-route/per-direction generated id)
  const renderedStopIds = new Set<string>();
  const stopsToRender: { stop: BusStop; route: BusRoute; isFirst: boolean; isLast: boolean }[] = [];

  for (const route of BUS_ROUTES) {
    // Skip the selected route — its stops are already shown by RoutePolyline
    if (route.id === selectedRouteId) continue;

    for (let idx = 0; idx < route.stops.length; idx++) {
      const stop = route.stops[idx]!;
      if (renderedStopIds.has(stop.gtfsStopId)) continue;
      renderedStopIds.add(stop.gtfsStopId);
      stopsToRender.push({
        stop,
        route,
        isFirst: idx === 0,
        isLast: idx === route.stops.length - 1,
      });
    }

    for (let idx = 0; idx < route.stopsReturn.length; idx++) {
      const stop = route.stopsReturn[idx]!;
      if (renderedStopIds.has(stop.gtfsStopId)) continue;
      renderedStopIds.add(stop.gtfsStopId);
      stopsToRender.push({
        stop,
        route,
        isFirst: idx === 0,
        isLast: idx === route.stopsReturn.length - 1,
      });
    }
  }

  return (
    <>
      {stopsToRender.map(({ stop, route, isFirst, isLast }) => (
        <StopMarker
          key={stop.gtfsStopId}
          stop={stop}
          route={route}
          isFirst={isFirst}
          isLast={isLast}
          isSelected={stop.gtfsStopId === selectedStopGtfsId}
          onClick={() => onStopClick(stop)}
        />
      ))}
    </>
  );
}
