import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { BusRoute, BusStop } from "@/data/tirana-bus-data.ts";

type Props = {
  stop: BusStop;
  route: BusRoute;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
};

function createStopIcon(color: string, isTerminal: boolean) {
  const size = isTerminal ? 14 : 10;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size + 4}" height="${size + 4}">
      <circle cx="${(size + 4) / 2}" cy="${(size + 4) / 2}" r="${size / 2}" 
        fill="${isTerminal ? color : "white"}" 
        stroke="${color}" 
        stroke-width="${isTerminal ? 2 : 2.5}"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    className: "",
  });
}

export default function StopMarker({ stop, route, isFirst, isLast, onClick }: Props) {
  const isTerminal = isFirst || isLast;
  const icon = createStopIcon(route.color, isTerminal);

  return (
    <Marker
      position={[stop.lat, stop.lng]}
      icon={icon}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <div className="min-w-[160px]">
          <p className="font-semibold text-sm">{stop.name}</p>
          <div className="flex items-center gap-1 mt-1">
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: route.color }}
            />
            <span className="text-xs text-gray-600">Line {route.number}</span>
          </div>
          {isTerminal && (
            <span className="text-xs text-gray-500 mt-1 block">
              {isFirst ? "Starting Terminal" : "End Terminal"}
            </span>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
